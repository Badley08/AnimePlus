package com.karlitodev.animeplus.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.karlitodev.animeplus.download.VideoDownloader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.lang.ref.WeakReference

class DownloadBridge(
    context: Context,
    webView: WebView
) {
    // applicationContext : ne retient pas une Activity pendant un long téléchargement
    private val context: Context = context.applicationContext

    // WeakReference : le bridge ne maintient pas la WebView en vie après sa destruction
    private val webViewRef = WeakReference(webView)

    // Un seul scope partagé : une exception dans une tâche n'annule pas les autres
    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @JavascriptInterface
    fun download(url: String, filename: String, callbackId: String) {
        if (!isHttpUrl(url)) {
            runJs("window.onDownloadDone && window.onDownloadDone(${js(callbackId)}, null, ${js("URL invalide")})")
            return
        }

        ioScope.launch {
            try {
                VideoDownloader.download(
                    context = context,
                    url = url,
                    filename = filename,
                    onProgress = { percent ->
                        runJs("window.onDownloadProgress && window.onDownloadProgress(${js(callbackId)}, $percent)")
                    },
                    onSuccess = { path ->
                        runJs("window.onDownloadDone && window.onDownloadDone(${js(callbackId)}, ${js(path)}, null)")
                    },
                    onError = { error ->
                        runJs("window.onDownloadDone && window.onDownloadDone(${js(callbackId)}, null, ${js(error)})")
                    }
                )
            } catch (e: Exception) {
                runJs("window.onDownloadDone && window.onDownloadDone(${js(callbackId)}, null, ${js(e.message ?: "Erreur de téléchargement")})")
            }
        }
    }

    /**
     * Télécharge ET compresse directement en arrière-plan avec Media3 Transformer
     */
    @JavascriptInterface
    fun downloadAndCompress(url: String, quality: String, filename: String, callbackId: String) {
        if (!isHttpUrl(url)) {
            runJs("window.onDownloadCompressDone && window.onDownloadCompressDone(${js(callbackId)}, null, ${js("URL invalide")})")
            return
        }

        VideoDownloader.downloadAndCompress(
            context = context,
            url = url,
            targetQuality = quality,
            filename = filename,
            onStage = { stage, percent ->
                runJs("window.onDownloadCompressProgress && window.onDownloadCompressProgress(${js(callbackId)}, ${js(stage)}, $percent)")
            },
            onSuccess = { path ->
                runJs("window.onDownloadCompressDone && window.onDownloadCompressDone(${js(callbackId)}, ${js(path)}, null)")
            },
            onError = { error ->
                runJs("window.onDownloadCompressDone && window.onDownloadCompressDone(${js(callbackId)}, null, ${js(error)})")
            }
        )
    }

    // Seuls http et https sont acceptés (pas de file://, content://, javascript:, etc.)
    private fun isHttpUrl(url: String): Boolean {
        return url.startsWith("http://", ignoreCase = true) ||
            url.startsWith("https://", ignoreCase = true)
    }

    // Convertit une valeur Kotlin en littéral JavaScript sûr (guillemets, \, retours à la ligne échappés)
    private fun js(value: String?): String {
        return if (value == null) "null" else JSONObject.quote(value)
    }

    // post { } s'exécute sur le main thread et ne fait rien si la WebView n'existe plus
    private fun runJs(script: String) {
        val view = webViewRef.get() ?: return
        view.post {
            try {
                view.evaluateJavascript(script, null)
            } catch (_: Exception) {
                // WebView déjà détruite : on ignore
            }
        }
    }
}