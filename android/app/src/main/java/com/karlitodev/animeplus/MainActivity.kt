package com.karlitodev.animeplus

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.*
import android.view.WindowManager
import android.view.View
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.karlitodev.animeplus.bridge.*
import com.karlitodev.animeplus.server.LocalProxyServer
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.InputStream
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private companion object {
        const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
    }

    private lateinit var webView: WebView
    private var localServer: LocalProxyServer? = null

    // Client OkHttp dédié à l'interception transparente dans la WebView
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    @SuppressLint("SetJavaScriptEnabled")
    @Suppress("DEPRECATION")
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
                if (request == null) return null
                val url = request.url?.toString() ?: return null

                // Seules les requêtes GET sont interceptées : un POST ou un preflight OPTIONS
                // serait sinon transformé en GET et perdrait son corps
                if (request.method != "GET") return super.shouldInterceptRequest(view, request)

                // Si la requête concerne Anime-Sama ou VoirAnime, on l'intercepte via OkHttp natif
                if (url.contains("anime-sama.to") || url.contains("voiranime.be")) {
                    var response: Response? = null
                    try {
                        val reqBuilder = Request.Builder()
                            .url(url)
                            .header("User-Agent", USER_AGENT)
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

                        response = okHttpClient.newCall(reqBuilder.build()).execute()

                        // WebResourceResponse refuse les codes 3xx et hors 100..599 (IllegalArgumentException)
                        // On laisse alors la WebView gérer la requête elle-même
                        if (response.code in 300..399 || response.code < 100 || response.code > 599) {
                            response.close()
                            return super.shouldInterceptRequest(view, request)
                        }

                        val rawMime = response.header("Content-Type") ?: "text/plain"
                        val mimeType = rawMime.split(";")[0].trim().ifEmpty { "text/plain" }
                        // Respecte le charset annoncé par le serveur au lieu de forcer UTF-8
                        val charset = response.body?.contentType()?.charset()?.name() ?: "UTF-8"
                        val inputStream: InputStream? = response.body?.byteStream()

                        val responseHeaders = mutableMapOf<String, String>()
                        response.headers.names().forEach { name ->
                            responseHeaders[name] = response.headers.values(name).joinToString(", ")
                        }
                        // Ajout des permissions CORS pour la WebView
                        responseHeaders["Access-Control-Allow-Origin"] = "*"
                        responseHeaders["Access-Control-Allow-Headers"] = "*"

                        // La WebView ferme elle-même le flux une fois la lecture terminée
                        return WebResourceResponse(
                            mimeType,
                            charset,
                            response.code,
                            response.message.ifEmpty { "OK" },
                            responseHeaders,
                            inputStream
                        )
                    } catch (e: Exception) {
                        // Ferme la réponse si on n'a pas pu la remettre à la WebView
                        try { response?.close() } catch (_: Exception) {}
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

        // Bouton retour (remplace onBackPressed, déprécié) : même logique qu'avant
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.evaluateJavascript("window.Router && Router.back()", null)
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // Charge l'application
        webView.loadUrl("file:///android_asset/www/index.html")
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
        localServer = null
        // Annule les requêtes encore en cours pour ne pas écrire dans une WebView détruite
        okHttpClient.dispatcher.cancelAll()
        // Détache la WebView de son parent avant de la détruire (évite une fuite mémoire)
        (webView.parent as? android.view.ViewGroup)?.removeView(webView)
        webView.removeAllViews()
        webView.destroy()
        super.onDestroy()
    }
}