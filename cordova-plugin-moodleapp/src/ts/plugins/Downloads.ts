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

/**
 * Save a copy of a downloaded file in the device Downloads.
 * Android: the public Download folder. iOS: the system "Save to Files" screen (the learner picks the folder).
 */
export class Downloads {

    /**
     * Save a copy of a local file.
     *
     * @param filePath Local file path or file:// URL.
     * @param fileName File name to save with.
     * @param mimeType Mime type.
     * @returns Whether it was saved (false when the learner cancelled on iOS), and the saved name.
     */
    async saveToDownloads(filePath: string, fileName: string, mimeType: string): Promise<DownloadsSaveResult> {
        return new Promise((resolve, reject) => {
            cordova.exec(resolve, reject, 'Downloads', 'saveToDownloads', [filePath, fileName, mimeType]);
        });
    }

}

export type DownloadsSaveResult = {
    saved: boolean;
    name: string;
    location: string;
};
