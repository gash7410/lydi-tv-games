package gr.lydi.tvgames;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Ενημέρωση της εφαρμογής από μέσα: διαβάζει το version.json της release «latest»,
 * κατεβάζει το νέο LydiTVGames.apk και ανοίγει την εγκατάσταση πάνω από την παλιά έκδοση.
 * Από JS: Capacitor.nativePromise('Updater', 'check' | 'install' | 'progress' | 'info', {}).
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    private static final String BASE = "https://github.com/gash7410/lydi-tv-games/releases/latest/download/";
    private static final String VERSION_URL = BASE + "version.json";
    private static final String APK_URL = BASE + "LydiTVGames.apk";

    private volatile boolean busy = false;
    private volatile long done = 0;
    private volatile long total = -1;

    private PackageInfo self() throws PackageManager.NameNotFoundException {
        Context c = getContext();
        return c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
    }

    @SuppressWarnings("deprecation")
    private static long codeOf(PackageInfo pi) {
        return Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "LydiTVGames-Updater");
        c.setRequestProperty("Cache-Control", "no-cache");
        int st = c.getResponseCode();
        if (st != 200) throw new Exception("HTTP " + st);
        return c;
    }

    @PluginMethod
    public void info(PluginCall call) {
        try {
            PackageInfo pi = self();
            JSObject r = new JSObject();
            r.put("code", codeOf(pi));
            r.put("name", pi.versionName);
            r.put("canInstall", canInstall());
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void check(PluginCall call) {
        new Thread(() -> {
            try {
                HttpURLConnection c = open(VERSION_URL + "?t=" + System.currentTimeMillis());
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                try (InputStream in = c.getInputStream()) {
                    byte[] b = new byte[4096];
                    int n;
                    while ((n = in.read(b)) > 0) buf.write(b, 0, n);
                } finally {
                    c.disconnect();
                }
                JSONObject j = new JSONObject(buf.toString("UTF-8"));
                long latest = j.optLong("code", 0);
                long current = codeOf(self());
                JSObject r = new JSObject();
                r.put("current", current);
                r.put("currentName", self().versionName);
                r.put("latest", latest);
                r.put("name", j.optString("name", ""));
                r.put("date", j.optString("date", ""));
                r.put("available", latest > current);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Δεν μπόρεσα να ελέγξω για νέα έκδοση (" + e.getMessage() + ")", "NETWORK");
            }
        }).start();
    }

    @PluginMethod
    public void progress(PluginCall call) {
        JSObject r = new JSObject();
        r.put("busy", busy);
        r.put("done", done);
        r.put("total", total);
        call.resolve(r);
    }

    @PluginMethod
    public void install(PluginCall call) {
        if (!canInstall()) {
            openInstallSettings();
            call.reject("Χρειάζεται άδεια εγκατάστασης", "PERMISSION");
            return;
        }
        if (busy) {
            call.reject("Η λήψη τρέχει ήδη", "BUSY");
            return;
        }
        busy = true;
        done = 0;
        total = -1;
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "update");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("δεν φτιάχνεται ο φάκελος");
                File apk = new File(dir, "LydiTVGames.apk");
                File part = new File(dir, "LydiTVGames.apk.part");
                HttpURLConnection c = open(APK_URL + "?t=" + System.currentTimeMillis());
                total = c.getContentLengthLong();
                try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part)) {
                    byte[] b = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(b)) > 0) {
                        out.write(b, 0, n);
                        done += n;
                    }
                } finally {
                    c.disconnect();
                }
                if (total > 0 && done != total) throw new Exception("η λήψη κόπηκε");
                if (apk.exists()) apk.delete();
                if (!part.renameTo(apk)) throw new Exception("δεν αποθηκεύτηκε το αρχείο");

                // έλεγχος: είναι όντως Lydi TV Games;
                PackageInfo pi = getContext().getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
                if (pi == null || !getContext().getPackageName().equals(pi.packageName)) {
                    throw new Exception("το αρχείο δεν είναι το Lydi TV Games");
                }
                JSObject r = new JSObject();
                r.put("code", codeOf(pi));
                r.put("name", pi.versionName);
                getActivity().runOnUiThread(() -> {
                    try {
                        launchInstaller(apk);
                        call.resolve(r);
                    } catch (Exception e) {
                        call.reject("Δεν άνοιξε η εγκατάσταση (" + e.getMessage() + ")", "INSTALLER");
                    }
                });
            } catch (Exception e) {
                call.reject("Η λήψη απέτυχε (" + e.getMessage() + ")", "DOWNLOAD");
            } finally {
                busy = false;
            }
        }).start();
    }

    private void launchInstaller(File apk) {
        Context c = getContext();
        Uri uri = FileProvider.getUriForFile(c, c.getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(i);
        } catch (ActivityNotFoundException e) {
            @SuppressWarnings("deprecation")
            Intent j = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            j.setData(uri);
            j.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(j);
        }
    }

    // Android 8+: ο χρήστης επιτρέπει μία φορά στο Lydi TV Games να εγκαθιστά εφαρμογές.
    private void openInstallSettings() {
        Context c = getContext();
        try {
            if (Build.VERSION.SDK_INT < 26) throw new Exception("old");
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(i);
            } catch (Exception ignored) {
            }
        }
    }
}
