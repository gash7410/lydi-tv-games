package gr.lydi.tvgames;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Η τηλεόραση δεν σβήνει / δεν μπαίνει σε προφύλαξη οθόνης όσο παίζεται το παιχνίδι.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
