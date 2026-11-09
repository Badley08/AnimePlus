package com.karlitodev.animeplus.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.karlitodev.animeplus.download.VideoDownloader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DownloadBridge(
    private val context: Context,
    private val webView: WebView
) {
    @JavascriptInterface
    fun download(url: String, filename: String, callbackId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            VideoDownloader.download(
                context = context,
                url = url,
                filename = filename,
                onProgress = { percent ->
                    CoroutineScope(Dispatchers.Main).launch {
                        webView.evaluateJavascript(
                            "window.onDownloadProgress && window.onDownloadProgress('$callbackId', $percent)",
                            null
                        )
                    }
                },
                onSuccess = { path ->
                    CoroutineScope(Dispatchers.Main).launch {
                        webView.evaluateJavascript(
                            "window.onDownloadDone && window.onDownloadDone('$callbackId', '$path', null)",
                            null
                        )
                    }
                },
                onError = { error ->
                    CoroutineScope(Dispatchers.Main).launch {
                        webView.evaluateJavascript(
                            "window.onDownloadDone && window.onDownloadDone('$callbackId', null, '${error.replace("'","\\'")}')",
                            null
                        )
                    }
                }
            )
        }
    }

    /**
     * Télécharge ET compresse directement en arrière-plan avec Media3 Transformer
     */
    @JavascriptInterface
    fun downloadAndCompress(url: String, quality: String, filename: String, callbackId: String) {
        VideoDownloader.downloadAndCompress(
            context = context,
            url = url,
            targetQuality = quality,
            filename = filename,
            onStage = { stage, percent ->
                CoroutineScope(Dispatchers.Main).launch {
                    webView.evaluateJavascript(
                        "window.onDownloadCompressProgress && window.onDownloadCompressProgress('$callbackId', '$stage', $percent)",
                        null
                    )
                }
            },
            onSuccess = { path ->
                CoroutineScope(Dispatchers.Main).launch {
                    webView.evaluateJavascript(
                        "window.onDownloadCompressDone && window.onDownloadCompressDone('$callbackId', '$path', null)",
                        null
                    )
                }
            },
            onError = { error ->
                CoroutineScope(Dispatchers.Main).launch {
                    webView.evaluateJavascript(
                        "window.onDownloadCompressDone && window.onDownloadCompressDone('$callbackId', null, '${error.replace("'","\\'")}')",
                        null
                    )
                }
            }
        )
    }
}
