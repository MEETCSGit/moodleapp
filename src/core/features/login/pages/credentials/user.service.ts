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
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class UserService {

    private storageKey = 'meetcslms';
    private privateToken = 'privatetoken';
    private idnumber: number | undefined;
    private latitudeKey = 'userLatitude';
    private longitudeKey = 'userLongitude';

    setUsername(username: string) {
        localStorage.setItem(this.storageKey, username);
    }

    getUsername(): string {
        return localStorage.getItem(this.storageKey) || '';
    }

    setPrivateToken(token: string): void {
        localStorage.setItem(this.privateToken, token);
    }

    getprivateToken(): string {
        return localStorage.getItem(this.privateToken) || '';
    }

    setRoleType(roleType: number | undefined): void {
        this.idnumber = roleType;
    }

    getRoleType(): number | undefined {
        return this.idnumber;
    }

    setLatitude(latitude: number): void {
        localStorage.setItem(this.latitudeKey, latitude.toString());
    }

    getLatitude(): number | undefined {
        const latitudeStr = localStorage.getItem(this.latitudeKey);

        return latitudeStr ? parseFloat(latitudeStr) : undefined;
    }

    setLongitude(longitude: number): void {
        localStorage.setItem(this.longitudeKey, longitude.toString());
    }

    getLongitude(): number | undefined {
        const longitudeStr = localStorage.getItem(this.longitudeKey);

        return longitudeStr ? parseFloat(longitudeStr) : undefined;
    }

}
