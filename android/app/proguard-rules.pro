-keepclassmembers class com.karlitodev.animeplus.bridge.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.karlitodev.animeplus.bridge.** { *; }
-keepattributes JavascriptInterface

-keep class com.karlitodev.animeplus.bridge.** { *; }
-keepclassmembers class com.karlitodev.animeplus.bridge.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keep class com.karlitodev.** { *; }
-keep class !android.**, !androidx.**, !com.**.* { *; }
-keep class com.karlitodev.animeplus.** { *; }
-keepattributes JavascriptInterface
-keepclassmembers class com.karlitodev.animeplus.bridge.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.karlitodev.animeplus.server.** { *; }
-keep class * extends com.karlitodev.animeplus.server.LocalProxyServer { *; }
-dontwarn com.karlitodev.**
-keep class com.karlitodev.** { *; }
-keep class * { <fields>; }
