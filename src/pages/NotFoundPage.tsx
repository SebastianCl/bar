import { FullPageState } from '../components/States';
export function NotFoundPage() {
  return (
    <FullPageState
      kind="error"
      title="Esta página no existe"
      description="La dirección puede haber cambiado."
      actionLabel="Ir a cuentas"
      actionHref="/cuentas"
    />
  );
}
