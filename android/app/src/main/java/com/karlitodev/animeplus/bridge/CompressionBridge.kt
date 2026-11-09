package com.karlitodev.animeplus.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.karlitodev.animeplus.compression.VideoCompressor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class CompressionBridge(
    private val context: Context,
    private val webView: WebView
) {
    /**
     * Appelé depuis JS : AndroidCompression.compress(inputPath, quality, callbackId)
     * quality : "480p" | "720p" | "1080p"
     * Émet des événements de progression vers JS via evaluateJavascript
     */
    @JavascriptInterface
    fun compress(inputPath: String, quality: String, callbackId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            VideoCompressor.compress(
                context = context,
                inputPath = inputPath,
                quality = quality,
                onProgress = { percent ->
                    CoroutineScope(Dispatchers.Main).launch {
                        webView.evaluateJavascript(
                            "window.onCompressionProgress && window.onCompressionProgress('$callbackId', $percent)",
                            null
                        )
                    }
                },
                onSuccess = { outputPath ->
                    CoroutineScope(Dispatchers.Main).launch {
                        webView.evaluateJavascript(
                            "window.onCompressionDone && window.onCompressionDone('$callbackId', '$outputPath', null)",
                            null
                        )
                    }
                },
                onError = { error ->
                    CoroutineScope(Dispatchers.Main).launch {
                        webView.evaluateJavascript(
                            "window.onCompressionDone && window.onCompressionDone('$callbackId', null, '${error.replace("'", "\\'")}')",
                            null
                        )
                    }
                }
            )
        }
    }

    @JavascriptInterface
    fun cancel() {
        VideoCompressor.cancel()
    }
}

