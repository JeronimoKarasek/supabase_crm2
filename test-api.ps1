# Script de Teste - INTERNAL_API_KEY
# Execute este script para testar as APIs com a nova chave

Write-Host "`n=== TESTE DE API - INTERNAL_API_KEY ===" -ForegroundColor Cyan
Write-Host "Chave: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=`n" -ForegroundColor Yellow

$apiKey = "Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
$baseUrl = "https://crm.farolbase.com"
# Para desenvolvimento local, descomente a linha abaixo:
# $baseUrl = "http://localhost:3000"

$headers = @{
    "x-api-key" = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "`n1. Testando endpoint de consulta de créditos..." -ForegroundColor Green
Write-Host "Informe um email para consultar (ou pressione Enter para pular):" -ForegroundColor Yellow
$email = Read-Host

if ($email) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/credits?email=$email" -Headers $headers -Method GET
        Write-Host "`n✅ SUCESSO!" -ForegroundColor Green
        Write-Host "Saldo: $($response.balanceBRL)" -ForegroundColor White
        Write-Host "Centavos: $($response.balanceCents)" -ForegroundColor Gray
    } catch {
        Write-Host "`n❌ ERRO:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host "`n2. Testando endpoint de adicionar créditos..." -ForegroundColor Green
Write-Host "Informe um email para adicionar R$ 10,00 (ou pressione Enter para pular):" -ForegroundColor Yellow
$emailAdd = Read-Host

if ($emailAdd) {
    try {
        $body = @{
            email = $emailAdd
            amountBRL = 10.00
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$baseUrl/api/credits/add" -Headers $headers -Method POST -Body $body
        Write-Host "`n✅ SUCESSO!" -ForegroundColor Green
        Write-Host "Novo saldo: $($response.newBalanceBRL)" -ForegroundColor White
    } catch {
        Write-Host "`n❌ ERRO:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host "`n3. Testando endpoint de cobranças mensais (preview)..." -ForegroundColor Green
Write-Host "Deseja verificar assinaturas pendentes? (S/N):" -ForegroundColor Yellow
$checkSubs = Read-Host

if ($checkSubs -eq "S" -or $checkSubs -eq "s") {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/subscriptions/charge-monthly" -Headers $headers -Method GET
        Write-Host "`n✅ SUCESSO!" -ForegroundColor Green
        Write-Host "Data: $($response.today)" -ForegroundColor Gray
        Write-Host "Assinaturas pendentes: $($response.pending)" -ForegroundColor White
        
        if ($response.subscriptions.Count -gt 0) {
            Write-Host "`nDetalhes:" -ForegroundColor Yellow
            $response.subscriptions | ForEach-Object {
                Write-Host "  - Produto: $($_.products.name)" -ForegroundColor White
                Write-Host "    Valor: R$ $([math]::Round($_.credit_price_cents / 100, 2))" -ForegroundColor Gray
                Write-Host "    Status: $($_.status)" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "`n❌ ERRO:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host "`n=== TESTE CONCLUÍDO ===" -ForegroundColor Cyan
Write-Host "Para mais exemplos, consulte: API_USAGE_GUIDE.md`n" -ForegroundColor Yellow
