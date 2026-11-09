package com.karlitodev.animeplus

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.*
import android.view.WindowManager
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.karlitodev.animeplus.bridge.*

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Plein écran immersif
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        )

        webView = WebView(this)
        setContentView(webView)

        // Config WebView optimisée
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true          // localStorage
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            // Perf sur vieux appareils
            setRenderPriority(WebSettings.RenderPriority.HIGH)
        }

        // Bridges JavaScript → Kotlin
        webView.addJavascriptInterface(
            WebAppInterface(this, webView), "Android"
        )
        webView.addJavascriptInterface(
            CompressionBridge(this, webView), "AndroidCompression"
        )
        webView.addJavascriptInterface(
            DownloadBridge(this, webView), "AndroidDownload"
        )
        webView.addJavascriptInterface(
            StorageBridge(this), "AndroidStorage"
        )

        // WebViewClient : intercepte les erreurs
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                // Charge une page d'erreur inline si ressource externe échoue
                if (request.isForMainFrame) {
                    view.loadData(
                        "<html><body style='background:#070B16;color:#EAF0FF;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><p>Erreur de chargement. Vérifie ta connexion.</p></body></html>",
                        "text/html", "UTF-8"
                    )
                }
            }
        }

        // WebChromeClient : permet la lecture vidéo plein écran
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                android.util.Log.d("AnimePlus_WebView",
                    "[${msg.messageLevel()}] ${msg.message()} @ ${msg.sourceId()}:${msg.lineNumber()}")
                return true
            }
        }

        // Charge l'app HTML depuis les assets
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            // Délègue le retour au JS (le router JS gère la navigation)
            webView.evaluateJavascript("window.Router && Router.back()", null)
        } else {
            super.onBackPressed()
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}

