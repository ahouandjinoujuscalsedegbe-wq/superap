package com.superapp.budget;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.security.MessageDigest;

/**
 * Contrôle d'intégrité de l'application installée.
 *
 * Renvoie l'empreinte SHA-256 du certificat de signature de l'APK en cours
 * d'exécution. Une application recompilée par un tiers est forcément signée
 * avec une autre clé : la partie web compare l'empreinte à celle attendue et
 * refuse de démarrer si elle diffère.
 *
 * Renvoie également des indices d'appareil compromis (root, émulateur, mode
 * débogage) afin de désactiver la synchronisation cloud dans ce cas.
 */
@CapacitorPlugin(name = "IntegriteApp")
public class IntegriteAppPlugin extends Plugin {

    private static String hexa(byte[] octets) {
        StringBuilder sb = new StringBuilder();
        for (byte o : octets) sb.append(String.format("%02x", o));
        return sb.toString();
    }

    private String empreinteSignature() {
        try {
            PackageManager pm = getContext().getPackageManager();
            String paquet = getContext().getPackageName();
            byte[] cert;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = pm.getPackageInfo(paquet, PackageManager.GET_SIGNING_CERTIFICATES);
                SigningInfo si = info.signingInfo;
                Signature[] signatures = si.hasMultipleSigners()
                    ? si.getApkContentsSigners()
                    : si.getSigningCertificateHistory();
                cert = signatures[0].toByteArray();
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo info = pm.getPackageInfo(paquet, PackageManager.GET_SIGNATURES);
                @SuppressWarnings("deprecation")
                Signature[] signatures = info.signatures;
                cert = signatures[0].toByteArray();
            }
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return hexa(md.digest(cert));
        } catch (Exception e) {
            return "";
        }
    }

    private boolean rooteApparent() {
        String[] chemins = {
            "/system/app/Superuser.apk", "/sbin/su", "/system/bin/su", "/system/xbin/su",
            "/data/local/xbin/su", "/data/local/bin/su", "/system/sd/xbin/su",
            "/system/bin/failsafe/su", "/data/local/su", "/su/bin/su", "/magisk"
        };
        for (String c : chemins) {
            if (new File(c).exists()) return true;
        }
        String tags = Build.TAGS;
        return tags != null && tags.contains("test-keys");
    }

    private boolean emulateurApparent() {
        String fp = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT;
        String modele = Build.MODEL == null ? "" : Build.MODEL;
        String produit = Build.PRODUCT == null ? "" : Build.PRODUCT;
        return fp.startsWith("generic")
            || fp.contains("unknown")
            || modele.contains("Emulator")
            || modele.contains("Android SDK built for")
            || produit.contains("sdk_gphone")
            || "google_sdk".equals(produit);
    }

    @PluginMethod
    public void verifier(PluginCall call) {
        JSObject r = new JSObject();
        r.put("paquet", getContext().getPackageName());
        r.put("signature", empreinteSignature());
        r.put("rooté", rooteApparent());
        r.put("emulateur", emulateurApparent());
        try {
            String installateur = getContext().getPackageManager()
                .getInstallerPackageName(getContext().getPackageName());
            r.put("installateur", installateur == null ? "" : installateur);
        } catch (Exception e) {
            r.put("installateur", "");
        }
        call.resolve(r);
    }
}
