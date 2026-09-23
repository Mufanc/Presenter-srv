export const isResetPath = (url: string) => new URL(url).pathname === '/ncr'

export function requestPath(url: string, isNavigation: boolean): string {
    return isNavigation ? 'index.html' : new URL(url).pathname.replace(/^\//, '')
}
