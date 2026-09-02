package com.superapp.budget;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.telephony.SmsMessage;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Lecteur local de la boîte de réception SMS.
 *
 * Les messages ne quittent jamais le téléphone : ils sont simplement remis à
 * la partie web de l'application, qui en extrait les montants des revenus et
 * des dépenses. Aucun envoi réseau n'est effectué ici.
 */
@CapacitorPlugin(
    name = "SMSInboxReader",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS }, alias = "sms")
    }
)
public class SMSInboxReaderPlugin extends Plugin {

    private BroadcastReceiver recepteur;

    private boolean autorise() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS)
            == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void load() {
        recepteur = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                // Un nouveau message vient d'arriver : la partie web relit
                // immédiatement la boîte de réception.
                JSObject evenement = new JSObject();
                evenement.put("date", System.currentTimeMillis());
                try {
                    SmsMessage[] messages = android.provider.Telephony.Sms.Intents.getMessagesFromIntent(intent);
                    if (messages != null && messages.length > 0) {
                        evenement.put("expediteur", messages[0].getOriginatingAddress());
                    }
                } catch (Exception ignore) {
                    // L'événement reste utile même sans détail sur l'expéditeur.
                }
                notifyListeners("smsRecu", evenement, true);
            }
        };
        IntentFilter filtre = new IntentFilter("android.provider.Telephony.SMS_RECEIVED");
        filtre.setPriority(999);
        if (Build.VERSION.SDK_INT >= 33) {
            getContext().registerReceiver(recepteur, filtre, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(recepteur, filtre);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (recepteur != null) {
            try {
                getContext().unregisterReceiver(recepteur);
            } catch (Exception ignore) {
                // Le récepteur pouvait déjà être libéré par le système.
            }
            recepteur = null;
        }
    }

    /** Liste les SMS reçus, du plus récent au plus ancien. */
    @PluginMethod
    public void getSMSList(PluginCall call) {
        if (!autorise()) {
            call.reject("permission_refusee");
            return;
        }

        JSObject filtre = call.getObject("filter", new JSObject());
        long minDate = 0L;
        int maxCount = 200;
        if (filtre != null) {
            if (filtre.has("minDate")) {
                minDate = filtre.optLong("minDate", 0L);
            }
            if (filtre.has("maxCount")) {
                maxCount = filtre.optInt("maxCount", 200);
            }
        }

        JSArray liste = new JSArray();
        Cursor curseur = null;
        try {
            curseur = getContext()
                .getContentResolver()
                .query(
                    Uri.parse("content://sms/inbox"),
                    new String[] { "_id", "address", "body", "date" },
                    minDate > 0 ? "date >= ?" : null,
                    minDate > 0 ? new String[] { String.valueOf(minDate) } : null,
                    "date DESC"
                );

            if (curseur != null) {
                int colonneId = curseur.getColumnIndex("_id");
                int colonneAdresse = curseur.getColumnIndex("address");
                int colonneCorps = curseur.getColumnIndex("body");
                int colonneDate = curseur.getColumnIndex("date");
                int lus = 0;
                while (curseur.moveToNext() && lus < maxCount) {
                    JSObject message = new JSObject();
                    message.put("id", colonneId >= 0 ? curseur.getString(colonneId) : null);
                    message.put("address", colonneAdresse >= 0 ? curseur.getString(colonneAdresse) : "");
                    message.put("body", colonneCorps >= 0 ? curseur.getString(colonneCorps) : "");
                    message.put("date", colonneDate >= 0 ? curseur.getLong(colonneDate) : 0L);
                    liste.put(message);
                    lus++;
                }
            }
        } catch (Exception erreur) {
            call.reject("lecture_impossible", erreur);
            return;
        } finally {
            if (curseur != null) {
                curseur.close();
            }
        }

        JSObject reponse = new JSObject();
        reponse.put("smsList", liste);
        call.resolve(reponse);
    }
}
