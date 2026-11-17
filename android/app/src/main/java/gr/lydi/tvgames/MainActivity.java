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
        // Μόνο στο μενού των παιχνιδιών κλείνει η εφαρμογή, όπως πριν.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final OnBackPressedCallback self = this;
                if (getBridge() == null || getBridge().getWebView() == null) { exitApp(self); return; }
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{return !!(window.tvBack&&window.tvBack());}catch(e){return false;}})()",
                    value -> { if (!"true".equals(value)) exitApp(self); });
            }
        });
    }

    private void exitApp(OnBackPressedCallback cb) {
        cb.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        cb.setEnabled(true);
    }
}
