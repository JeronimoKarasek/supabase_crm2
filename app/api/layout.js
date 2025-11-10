// API routes não precisam de autenticação via AuthGuard
// O layout vazio permite que as rotas de API sejam públicas
export default function ApiLayout({ children }) {
  return children
}
