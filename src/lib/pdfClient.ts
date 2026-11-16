import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

/**
 * Certaines WebView Android un peu anciennes n'exposent pas encore
 * `Promise.withResolvers`, utilisé par pdf.js. On ajoute un polyfill minimal
 * pour que le viewer PDF reste utilisable dans l'application.
 */
type WithResolvers = <T>() => {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const promiseConstructor = Promise as unknown as { withResolvers?: WithResolvers }

if (typeof promiseConstructor.withResolvers !== 'function') {
  promiseConstructor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

export { getDocument }
export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
