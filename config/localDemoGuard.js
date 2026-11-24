const isDemoModule = (value) => /(^|\/)(demo\.html|src\/demo\/|src\/data\/demoWorkers(?:\.js)?$|src\/services\/workers\/memoryWorkerRepository(?:\.js)?$)/.test(String(value).replaceAll('\\', '/').split('?')[0])

export function createLocalDemoGuard({ command, mode, isPreview = false }) {
  const demo = mode === 'local-demo'
  if (demo && (command !== 'serve' || isPreview)) {
    throw new Error('La demostración solo admite un servidor local de desarrollo; no se puede compilar ni publicar.')
  }
  function protect(server) {
    server.middlewares.use((req, res, next) => {
      let path
      try { path = decodeURIComponent((req.url || '/').split('?')[0]) } catch { res.statusCode = 400; res.end(); return }
      if (!demo && isDemoModule(path)) { res.statusCode = 404; res.end('No disponible.'); return }
      if (demo) {
        res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'")
        res.setHeader('Cache-Control', 'no-store')
        if (path === '/') { res.statusCode = 302; res.setHeader('Location', '/demo.html'); res.end(); return }
        if (/^\/(index\.html|src\/(main\.jsx|App\.jsx|lib\/supabase|services\/supabase\/|context\/|hooks\/useAuth))/.test(path)) {
          res.statusCode = 403; res.end('La demo no utiliza el flujo real.'); return
        }
      }
      next()
    })
  }
  return {
    name: 'priteca-local-demo-guard', enforce: 'pre',
    configResolved(config) {
      if (demo && !['127.0.0.1', 'localhost', '::1'].includes(config.server.host)) {
        throw new Error('La demo solo puede escucharse en loopback (127.0.0.1).')
      }
    },
    configureServer: protect,
    configurePreviewServer: protect,
    resolveId(id) {
      if (command === 'build' && isDemoModule(id)) throw new Error('El build normal no puede incluir la demo o sus datos ficticios.')
      return null
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (isDemoModule(output.fileName) || (output.moduleIds || []).some(isDemoModule)) {
          throw new Error('Se detectaron recursos de demostración en el build.')
        }
      }
    },
  }
}
