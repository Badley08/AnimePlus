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
                            "window.onDownloadDone && window.onDownloadDone('$callbackId', null, '${error.replace("'","\\'")}' )",
                            null
                        )
                    }
                }
            )
        }
    }
}

