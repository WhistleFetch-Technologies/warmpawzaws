package com.warmpawz.vendor;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enable Chrome remote inspection (chrome://inspect#devices) for the Capacitor WebView.
        // Required to diagnose the Android-only gallery upload path (Capawesome FilePicker /
        // content:// URI conversion). Kept on for release builds too while we stabilize the
        // photo upload — re-gate behind BuildConfig.DEBUG once the bug is closed.
        WebView.setWebContentsDebuggingEnabled(true);
    }
}
