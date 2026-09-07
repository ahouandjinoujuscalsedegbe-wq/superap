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

import java.security.MessageDigest;

/**
 * Contrôle d'intégrité de l'application installée.
 *
 * Renvoie l'empreinte SHA-256 du certificat de signature de l'APK en cours
 * d'exécution. Une application recompilée par un tiers est forcément signée
 * avec une autre clé : la partie web compare l'empreinte à celle attendue et
 * refuse de démarrer si elle diffère.
 *
 * Ce contrôle se limite volontairement au certificat de signature. Les
 * recherches de fichiers root/émulateur ressemblent à des techniques
 * d'évasion utilisées par des logiciels malveillants et peuvent déclencher
 * les heuristiques de Play Protect.
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

    @PluginMethod
    public void verifier(PluginCall call) {
        JSObject r = new JSObject();
        r.put("paquet", getContext().getPackageName());
        r.put("signature", empreinteSignature());
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
