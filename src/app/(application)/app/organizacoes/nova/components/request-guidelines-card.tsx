export function RequestGuidelinesCard() {
  return (
    <section className="rounded-lg border bg-background p-5">
      <h2 className="text-base font-semibold">Como funciona a análise</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          O CNPJ é consultado na BrasilAPI no envio, para obter a razão social e
          confirmar o CNAE do grupo 94.
        </li>
        <li>
          A administração da plataforma analisa a ata de eleição antes de
          aprovar.
        </li>
        <li>
          Na aprovação, a organização é criada em configuração com você como
          presidente ativo.
        </li>
        <li>A ata aceita PDF, JPEG ou PNG de até 3 MB.</li>
      </ul>
    </section>
  )
}
