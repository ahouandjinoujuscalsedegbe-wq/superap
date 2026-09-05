package com.superapp.budget;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Lecture (seule) de la boîte de réception SMS pour détecter les messages de
 * transaction. Aucun message n'est envoyé hors de l'appareil : le plugin
 * retourne uniquement le contenu à l'application, qui l'analyse localement.
 */
@CapacitorPlugin(
    name = "SMSInboxReader",
    permissions = {
        @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS })
    }
)
public class SMSInboxReaderPlugin extends Plugin {

    private boolean autorise() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS)
            == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void verifierPermission(PluginCall call) {
        JSObject retour = new JSObject();
        retour.put("accordee", autorise());
        call.resolve(retour);
    }

    @PluginMethod
    public void demanderPermission(PluginCall call) {
        if (autorise()) {
            JSObject retour = new JSObject();
            retour.put("accordee", true);
            call.resolve(retour);
            return;
        }
        requestPermissionForAlias("sms", call, "resultatPermission");
    }

    @PermissionCallback
    private void resultatPermission(PluginCall call) {
        JSObject retour = new JSObject();
        retour.put("accordee", autorise());
        call.resolve(retour);
    }

    @PluginMethod
    public void lireMessages(PluginCall call) {
        if (!autorise()) {
            call.reject("Autorisation de lecture des SMS non accordée.");
            return;
        }

        long depuis = call.getLong("depuis", 0L);
        int limite = call.getInt("limite", 200);

        JSArray messages = new JSArray();
        Cursor curseur = null;
        try {
            curseur = getContext().getContentResolver().query(
                Uri.parse("content://sms/inbox"),
                new String[] { "_id", "address", "body", "date" },
                "date >= ?",
                new String[] { String.valueOf(depuis) },
                "date DESC"
            );

            if (curseur != null) {
                int compte = 0;
                while (curseur.moveToNext() && compte < limite) {
                    JSObject message = new JSObject();
                    message.put("id", curseur.getString(0));
                    message.put("expediteur", curseur.getString(1) == null ? "" : curseur.getString(1));
                    message.put("texte", curseur.getString(2) == null ? "" : curseur.getString(2));
                    message.put("recuLe", curseur.getLong(3));
                    messages.put(message);
                    compte++;
                }
            }
        } catch (Exception erreur) {
            call.reject("Lecture des messages impossible : " + erreur.getMessage());
            return;
        } finally {
            if (curseur != null) curseur.close();
        }

        JSObject retour = new JSObject();
        retour.put("messages", messages);
        call.resolve(retour);
    }
}
