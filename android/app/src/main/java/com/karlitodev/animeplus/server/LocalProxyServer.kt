package com.karlitodev.animeplus.server

import android.content.Context
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import java.io.*
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Serveur HTTP Proxy local 100% embarqué dans l'APK.
 * Tourne sur 127.0.0.1:8888.
 * Fournit l'endpoint /proxy?url=... avec OkHttp natif (contourne CORS, Cloudflare et Referer).
 */
class LocalProxyServer(private val context: Context, private val port: Int = 8888) {

    private var serverSocket: ServerSocket? = null
    private var isRunning = false
    private val threadPool = Executors.newCachedThreadPool()

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    fun start() {
        if (isRunning) return
        isRunning = true

        threadPool.execute {
            try {
                serverSocket = ServerSocket(port)
                Log.d("LocalProxyServer", "Serveur proxy local démarré sur http://127.0.0.1:$port")

                while (isRunning) {
                    try {
                        val clientSocket = serverSocket?.accept() ?: break
                        threadPool.execute { handleClient(clientSocket) }
                    } catch (e: Exception) {
                        if (!isRunning) break
                    }
                }
            } catch (e: Exception) {
                Log.e("LocalProxyServer", "Erreur serveur local: ${e.message}")
            }
        }
    }

    private fun handleClient(socket: Socket) {
        try {
            val input = BufferedReader(InputStreamReader(socket.getInputStream()))
            val output = BufferedOutputStream(socket.getOutputStream())

            val requestLine = input.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return

            val method = parts[0]
            val path = parts[1]

            // Lecture des headers
            var line: String?
            var contentLength = 0
            var contentType = "application/x-www-form-urlencoded"

            while (input.readLine().also { line = it } != null) {
                if (line.isNullOrEmpty()) break
                val lower = line!!.lowercase()
                if (lower.startsWith("content-length:")) {
                    contentLength = line!!.substringAfter(":").trim().toIntOrNull() ?: 0
                } else if (lower.startsWith("content-type:")) {
                    contentType = line!!.substringAfter(":").trim()
                }
            }

            if (method == "OPTIONS") {
                val resp = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\nContent-Length: 0\r\n\r\n"
                output.write(resp.toByteArray())
                output.flush()
                socket.close()
                return
            }

            if (path.startsWith("/proxy")) {
                val queryStr = path.substringAfter("?", "")
                var targetUrl: String? = null

                for (pair in queryStr.split("&")) {
                    val kv = pair.split("=")
                    if (kv.size == 2 && kv[0] == "url") {
                        targetUrl = URLDecoder.decode(kv[1], "UTF-8")
                        break
                    }
                }

                if (targetUrl == null) {
                    val err = "HTTP/1.1 400 Bad Request\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 15\r\n\r\nMissing url param"
                    output.write(err.toByteArray())
                    output.flush()
                    socket.close()
                    return
                }

                val reqBuilder = Request.Builder()
                    .url(targetUrl)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36")
                    .header("Accept", "*/*")

                // Injection du Referer exact pour Anime-Sama et VoirAnime
                if (targetUrl.contains("anime-sama.to")) {
                    if (targetUrl.contains("episodes.js")) {
                        reqBuilder.header("Referer", targetUrl.substringBefore("episodes.js"))
                    } else {
                        reqBuilder.header("Referer", "https://anime-sama.to/")
                    }
                } else if (targetUrl.contains("voiranime")) {
                    reqBuilder.header("Referer", "https://voiranime.be/")
                }

                if (method == "POST") {
                    val bodyChars = CharArray(contentLength)
                    input.read(bodyChars, 0, contentLength)
                    val bodyStr = String(bodyChars)
                    val reqBody = bodyStr.toRequestBody(contentType.toMediaTypeOrNull())
                    reqBuilder.post(reqBody)
                }

                try {
                    val response = httpClient.newCall(reqBuilder.build()).execute()
                    val bodyBytes = response.body?.bytes() ?: ByteArray(0)
                    val mime = response.header("Content-Type") ?: "text/plain; charset=utf-8"

                    val headerResp = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: $mime\r\nContent-Length: ${bodyBytes.size}\r\nConnection: close\r\n\r\n"
                    output.write(headerResp.toByteArray())
                    output.write(bodyBytes)
                    output.flush()
                } catch (e: Exception) {
                    val errBytes = (e.message ?: "Proxy fetch failed").toByteArray()
                    val errResp = "HTTP/1.1 502 Bad Gateway\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\nContent-Length: ${errBytes.size}\r\nConnection: close\r\n\r\n"
                    output.write(errResp.toByteArray())
                    output.write(errBytes)
                    output.flush()
                }
            } else {
                val notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"
                output.write(notFound.toByteArray())
                output.flush()
            }
        } catch (e: Exception) {
            Log.e("LocalProxyServer", "Client handler error: ${e.message}")
        } finally {
            try { socket.close() } catch (_: Exception) {}
        }
    }

    fun stop() {
        isRunning = false
        try {
            serverSocket?.close()
        } catch (_: Exception) {}
        serverSocket = null
    }
}
