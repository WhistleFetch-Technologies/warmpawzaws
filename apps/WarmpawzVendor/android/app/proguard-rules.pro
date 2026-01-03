# ============================================================================
# WARMPAWZ VENDOR APP - PROGUARD RULES
# ============================================================================

# React Native Rules
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# React Native Maps
-keep class com.airbnb.android.react.maps.** { *; }
-keep class com.google.android.gms.maps.** { *; }

# Expo modules
-keep class expo.modules.** { *; }
-keepclassmembers class expo.modules.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.stream.** { *; }

# Keep BuildConfig
-keep class com.warmpawz.vendor.BuildConfig { *; }

# Keep JS interface classes  
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
    @com.facebook.react.bridge.ReactProp *;
}

# NetInfo
-keep class com.reactnativecommunity.netinfo.** { *; }

# Linear Gradient
-keep class com.BV.LinearGradient.** { *; }

# SVG
-keep class com.horcrux.svg.** { *; }

# Keep source file names for better crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
