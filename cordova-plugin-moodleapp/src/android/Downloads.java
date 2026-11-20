// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package com.moodle.moodlemobile;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Saves a copy of a downloaded file (certificate, invoice) in the device public Download folder.
 *
 * Android 10 and later: MediaStore Downloads, no permission needed; a file with the same name gets a number added.
 * Android 7 to 9: the storage permission is asked once, then the file is copied to the Download folder.
 */
public class Downloads extends CordovaPlugin {

    private static final int PERMISSION_REQUEST = 7401;

    private CallbackContext pendingCallback;
    private JSONArray pendingArgs;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
        if (!"saveToDownloads".equals(action)) {
            return false;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && !cordova.hasPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            pendingCallback = callbackContext;
            pendingArgs = args;
            cordova.requestPermission(this, PERMISSION_REQUEST, Manifest.permission.WRITE_EXTERNAL_STORAGE);
            return true;
        }

        save(args, callbackContext);
        return true;
    }

    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != PERMISSION_REQUEST || pendingCallback == null) {
            return;
        }
        CallbackContext callbackContext = pendingCallback;
        JSONArray args = pendingArgs;
        pendingCallback = null;
        pendingArgs = null;

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            save(args, callbackContext);
        } else {
            callbackContext.error("permission_denied");
        }
    }

    /**
     * Copy the file in a background thread.
     *
     * @param args [source file path or file:// URL, file name, mime type]
     * @param callbackContext Callback.
     */
    private void save(final JSONArray args, final CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                String source = args.getString(0);
                String name = args.getString(1);
                String mimeType = args.optString(2, "application/pdf");
                File sourceFile = new File(source.startsWith("file:") ? Uri.parse(source).getPath() : source);
                if (!sourceFile.exists()) {
                    callbackContext.error("file_not_found");
                    return;
                }

                String savedName = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveWithMediaStore(sourceFile, name, mimeType)
                    : saveToPublicFolder(sourceFile, name, mimeType);

                JSONObject result = new JSONObject();
                result.put("saved", true);
                result.put("name", savedName);
                result.put("location", Environment.DIRECTORY_DOWNLOADS);
                callbackContext.success(result);
            } catch (Exception e) {
                callbackContext.error(e.getMessage() == null ? "save_failed" : e.getMessage());
            }
        });
    }

    /**
     * Android 10 and later.
     */
    private String saveWithMediaStore(File source, String name, String mimeType) throws Exception {
        ContentResolver resolver = cordova.getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, name);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new Exception("save_failed");
        }
        try (InputStream in = new FileInputStream(source); OutputStream out = resolver.openOutputStream(uri)) {
            copy(in, out);
        } catch (Exception e) {
            resolver.delete(uri, null, null);
            throw e;
        }

        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(uri, values, null, null);

        // MediaStore may have added a number to avoid a duplicate name.
        String saved = name;
        try (android.database.Cursor cursor = resolver.query(uri,
                new String[] {MediaStore.Downloads.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                saved = cursor.getString(0);
            }
        }
        return saved;
    }

    /**
     * Android 7 to 9.
     */
    @SuppressWarnings("deprecation")
    private String saveToPublicFolder(File source, String name, String mimeType) throws Exception {
        File folder = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!folder.exists() && !folder.mkdirs()) {
            throw new Exception("save_failed");
        }

        File target = new File(folder, name);
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String extension = dot > 0 ? name.substring(dot) : "";
        for (int i = 1; target.exists(); i++) {
            target = new File(folder, base + " (" + i + ")" + extension);
        }

        try (InputStream in = new FileInputStream(source); OutputStream out = new FileOutputStream(target)) {
            copy(in, out);
        }
        MediaScannerConnection.scanFile(cordova.getContext(), new String[] {target.getAbsolutePath()},
            new String[] {mimeType}, null);
        return target.getName();
    }

    private void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }
}
