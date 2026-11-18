package gr.lydi.tvgames;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdaterPlugin.class); // κουμπί «Ενημέρωση»: κατεβάζει και εγκαθιστά το νέο APK
        super.onCreate(savedInstanceState);
        // Η τηλεόραση δεν σβήνει / δεν μπαίνει σε προφύλαξη οθόνης όσο παίζεται το παιχνίδι.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // «Πίσω» του τηλεχειριστηρίου: μέσα σε παιχνίδι ρωτά «Έξοδος από το παιχνίδι;» (window.tvBack στο tv.js).
        // Η εφαρμογή κλείνει ΜΟΝΟ όταν το tvBack απαντήσει ρητά "exit" (ήσυχα στο μενού).
        // Σφάλμα, καθυστέρηση ή άγνωστη απάντηση = μένουμε ανοιχτοί.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final OnBackPressedCallback self = this;
                if (getBridge() == null || getBridge().getWebView() == null) return;
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{return window.tvBack?String(window.tvBack()):'none';}catch(e){return 'error';}})()",
                    value -> { if ("\"exit\"".equals(value)) exitApp(self); });
            }
        });
    }

    private void exitApp(OnBackPressedCallback cb) {
        cb.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        cb.setEnabled(true);
    }
}
