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

import { AfterViewInit, Component, ElementRef, Input, OnDestroy, QueryList, ViewChildren, inject } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { ModalController } from '@singletons';
import { coreIrclassFetchViewOnlyPdf } from './pdf-fetch';

/**
 * IRClass: the app's own viewer for view-only PDFs (site plugin local_irclass_resrestrict).
 *
 * Uses the pdf.js legacy build shipped with the app (src/assets/irclass/pdfjs), so it works on older Android WebViews and
 * does not depend on the website's viewer. The PDF is kept in memory only: no download, print, share or "open with".
 * If the PDF cannot be fetched, the website viewer is offered instead.
 */
@Component({
    selector: 'core-irclass-pdf-viewer',
    templateUrl: 'pdf-viewer.html',
    styleUrl: 'pdf-viewer.scss',
    imports: [CoreSharedModule],
})
export class CoreIrclassPdfViewerComponent implements AfterViewInit, OnDestroy {

    @Input({ required: true }) title!: string;
    @Input({ required: true }) pdfUrl!: string; // Website file address.
    @Input() openFallback?: () => Promise<void>; // Opens the website viewer.

    @ViewChildren('pageCanvas') canvases?: QueryList<ElementRef<HTMLCanvasElement>>;

    loading = true;
    failed = false;
    pages: number[] = [];
    zoom = 1;

    protected document?: PdfjsDocument;
    protected loadingTask?: PdfjsLoadingTask;
    protected observer?: IntersectionObserver;
    protected rendered = new Map<number, number>(); // Page number → zoom it was drawn at.
    protected rendering = new Set<number>();
    protected destroyed = false;
    protected element: ElementRef<HTMLElement> = inject(ElementRef);

    /**
     * @inheritdoc
     */
    async ngAfterViewInit(): Promise<void> {
        try {
            const [lib, data] = await Promise.all([loadPdfjs(), coreIrclassFetchViewOnlyPdf(this.pdfUrl)]);
            const base = pdfjsBaseUrl();
            this.loadingTask = lib.getDocument({
                data,
                cMapUrl: `${base}cmaps/`,
                cMapPacked: true,
                standardFontDataUrl: `${base}standard_fonts/`,
                wasmUrl: `${base}wasm/`,
                iccUrl: `${base}iccs/`,
                enableXfa: false,
            });
            this.document = await this.loadingTask.promise;

            if (this.destroyed) {
                this.loadingTask.destroy();

                return;
            }

            this.pages = Array.from({ length: this.document.numPages }, (_, index) => index + 1);
            this.loading = false;

            // Draw pages when they come into view, after the canvases exist.
            setTimeout(() => this.observePages());
        } catch {
            this.loading = false;
            this.failed = true;
        }
    }

    /**
     * Watch the page canvases and draw them when they come near the screen.
     */
    protected observePages(): void {
        this.observer?.disconnect();
        this.observer = new IntersectionObserver((entries) => {
            entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
                this.renderPage(Number((entry.target as HTMLElement).dataset.page));
            });
        }, { rootMargin: '600px 0px' });

        this.canvases?.forEach((canvas) => this.observer?.observe(canvas.nativeElement));
    }

    /**
     * Draw a page at the current zoom, fitting the screen width.
     *
     * @param pageNumber Page number.
     */
    protected async renderPage(pageNumber: number): Promise<void> {
        const canvas = this.canvases?.find((item) => Number(item.nativeElement.dataset.page) === pageNumber)?.nativeElement;
        if (!this.document || !canvas || this.rendering.has(pageNumber) || this.rendered.get(pageNumber) === this.zoom) {
            return;
        }

        this.rendering.add(pageNumber);
        const zoom = this.zoom;
        try {
            const page = await this.document.getPage(pageNumber);
            const container = this.element.nativeElement.querySelector('.core-irclass-pdf-pages');
            const width = (container?.clientWidth || window.innerWidth) - 16;
            const fitScale = width / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale: fitScale * zoom });
            // Sharp on high density screens, but limited so large pages do not use too much memory.
            const ratio = Math.min(window.devicePixelRatio || 1, 2);

            canvas.width = Math.floor(viewport.width * ratio);
            canvas.height = Math.floor(viewport.height * ratio);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            const context = canvas.getContext('2d');
            if (!context) {
                return;
            }
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            await page.render({ canvas, canvasContext: context, viewport }).promise;
            this.rendered.set(pageNumber, zoom);
        } catch {
            // Leave the page blank; it is drawn again on the next zoom or scroll.
        } finally {
            this.rendering.delete(pageNumber);
        }

        if (zoom !== this.zoom) {
            // The zoom changed while drawing.
            this.renderPage(pageNumber);
        }
    }

    /**
     * Change the zoom and draw the visible pages again.
     *
     * @param step +1 to zoom in, -1 to zoom out.
     */
    changeZoom(step: number): void {
        const levels = [1, 1.5, 2, 3];
        const index = Math.max(0, Math.min(levels.length - 1, levels.indexOf(this.zoom) + step));
        if (levels[index] === this.zoom) {
            return;
        }
        this.zoom = levels[index];
        this.rendered.clear();
        // Re-observing triggers drawing of the pages near the screen.
        this.observePages();
    }

    /**
     * Open the website viewer instead (the PDF could not be fetched).
     */
    async openWebsiteViewer(): Promise<void> {
        this.close();
        await this.openFallback?.();
    }

    /**
     * Close the viewer.
     */
    close(): void {
        ModalController.dismiss();
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.destroyed = true;
        this.observer?.disconnect();
        // Frees the PDF from memory and stops pdf.js.
        this.loadingTask?.destroy();
    }

}

/**
 * Address of the pdf.js files shipped with the app.
 *
 * @returns Address ending in a slash.
 */
function pdfjsBaseUrl(): string {
    return new URL('assets/irclass/pdfjs/', document.baseURI).href;
}

let pdfjsPromise: Promise<PdfjsLib> | undefined;

/**
 * Load pdf.js (an ES module, loaded outside the app bundle with a module script).
 *
 * @returns pdf.js.
 */
function loadPdfjs(): Promise<PdfjsLib> {
    if (pdfjsPromise) {
        return pdfjsPromise;
    }

    pdfjsPromise = new Promise<PdfjsLib>((resolve, reject) => {
        const win = window as unknown as { irclassPdfjs?: PdfjsLib };
        const base = pdfjsBaseUrl();
        const timeout = setTimeout(() => reject(new Error('pdf.js could not be loaded')), 30000);

        window.addEventListener('irclasspdfjsready', () => {
            clearTimeout(timeout);
            if (!win.irclassPdfjs) {
                reject(new Error('pdf.js could not be loaded'));

                return;
            }
            win.irclassPdfjs.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.js`;
            resolve(win.irclassPdfjs);
        }, { once: true });

        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `import * as lib from '${base}pdf.min.js';
window.irclassPdfjs = lib;
window.dispatchEvent(new Event('irclasspdfjsready'));`;
        document.head.appendChild(script);
    }).catch((error) => {
        pdfjsPromise = undefined; // Try again next time.

        throw error;
    });

    return pdfjsPromise;
}

/**
 * The parts of pdf.js used by the viewer.
 */
type PdfjsLib = {
    GlobalWorkerOptions: { workerSrc: string }; // eslint-disable-line @typescript-eslint/naming-convention
    getDocument(params: Record<string, unknown>): PdfjsLoadingTask;
};

type PdfjsLoadingTask = {
    promise: Promise<PdfjsDocument>;
    destroy(): Promise<void>;
};

type PdfjsDocument = {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfjsPage>;
};

type PdfjsPage = {
    getViewport(params: { scale: number }): { width: number; height: number };
    render(params: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: unknown }):
    { promise: Promise<void> };
};
