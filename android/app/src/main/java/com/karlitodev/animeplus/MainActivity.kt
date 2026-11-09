package com.karlitodev.animeplus

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.*
import android.view.WindowManager
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.karlitodev.animeplus.bridge.*
import com.karlitodev.animeplus.server.LocalProxyServer
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.InputStream
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var localServer: LocalProxyServer? = null

    // Client OkHttp dédié à l'interception transparente dans la WebView
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Serveur local embarqué dans l'APK (127.0.0.1:8888)
        localServer = LocalProxyServer(this, 8888).apply { start() }

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

        // Configuration WebView optimisée
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            setRenderPriority(WebSettings.RenderPriority.HIGH)
        }

        // Bridges JavaScript -> Kotlin
        webView.addJavascriptInterface(WebAppInterface(this, webView), "Android")
        webView.addJavascriptInterface(CompressionBridge(this, webView), "AndroidCompression")
        webView.addJavascriptInterface(DownloadBridge(this, webView), "AndroidDownload")
        webView.addJavascriptInterface(StorageBridge(this), "AndroidStorage")

        // WebViewClient avec Interception Native OkHttp (Architecture utilisée par Aniyomi / Mihon)
        webView.webViewClient = object : WebViewClient() {

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url?.toString() ?: return null

                // Si la requête concerne Anime-Sama ou VoirAnime, on l'intercepte via OkHttp natif
                if (url.contains("anime-sama.to") || url.contains("voiranime.be")) {
                    try {
                        val reqBuilder = Request.Builder()
                            .url(url)
                            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36")
                            .header("Accept", "*/*")

                        // Injection du Referer exact pour contourner la protection Cloudflare
                        if (url.contains("anime-sama.to")) {
                            if (url.contains("episodes.js")) {
                                reqBuilder.header("Referer", url.substringBefore("episodes.js"))
                            } else {
                                reqBuilder.header("Referer", "https://anime-sama.to/")
                            }
                        } else if (url.contains("voiranime")) {
                            reqBuilder.header("Referer", "https://voiranime.be/")
                        }

                        val response = okHttpClient.newCall(reqBuilder.build()).execute()
                        val rawMime = response.header("Content-Type") ?: "text/plain"
                        val mimeType = rawMime.split(";")[0].trim()
                        val inputStream: InputStream? = response.body?.byteStream()

                        val responseHeaders = mutableMapOf<String, String>()
                        response.headers.forEach { pair ->
                            responseHeaders[pair.first] = pair.second
                        }
                        // Ajout des permissions CORS pour la WebView
                        responseHeaders["Access-Control-Allow-Origin"] = "*"
                        responseHeaders["Access-Control-Allow-Headers"] = "*"

                        return WebResourceResponse(
                            mimeType,
                            "UTF-8",
                            response.code,
                            response.message.ifEmpty { "OK" },
                            responseHeaders,
                            inputStream
                        )
                    } catch (e: Exception) {
                        android.util.Log.e("AnimePlus_Interceptor", "Erreur interception OkHttp: ${e.message}")
                    }
                }

                return super.shouldInterceptRequest(view, request)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    view.loadData(
                        "<html><body style='background:#070B16;color:#EAF0FF;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><p>Erreur de chargement. Vérifie ta connexion.</p></body></html>",
                        "text/html", "UTF-8"
                    )
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                android.util.Log.d(
                    "AnimePlus_WebView",
                    "[${msg.messageLevel()}] ${msg.message()} @ ${msg.sourceId()}:${msg.lineNumber()}"
                )
                return true
            }
        }

        // Charge l'application
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
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
        localServer?.stop()
        webView.destroy()
        super.onDestroy()
    }
}
