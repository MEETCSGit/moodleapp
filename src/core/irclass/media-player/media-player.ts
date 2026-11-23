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

import { Component, Input } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { ModalController } from '@singletons';

/**
 * IRClass: full screen player for view-only video and audio (site plugin local_irclass_resrestrict).
 *
 * The media is streamed from the site inside the app and never saved on the device: no download, share or "open with"
 * controls, no other app involved. This is a deterrent like the website player page; screen recording cannot be stopped.
 */
@Component({
    selector: 'core-irclass-media-player',
    templateUrl: 'media-player.html',
    styleUrl: 'media-player.scss',
    imports: [CoreSharedModule],
})
export class CoreIrclassMediaPlayerComponent {

    @Input({ required: true }) title!: string;
    @Input({ required: true }) url!: string; // Streaming address, with the app's access key.
    @Input() isAudio = false;

    failed = false;

    /**
     * The site did not serve the media (for example "Mobile app media" is off on the site).
     */
    onError(): void {
        this.failed = true;
    }

    /**
     * Close the player.
     */
    close(): void {
        ModalController.dismiss();
    }

}
