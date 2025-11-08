-- Policies para permitir admin gerenciar empresas

-- Primeiro, remover políticas antigas se existirem
drop policy if exists empresa_admin_select on empresa;
drop policy if exists empresa_admin_insert on empresa;
drop policy if exists empresa_admin_update on empresa;
drop policy if exists empresa_admin_delete on empresa;

-- Policy para SELECT: admin vê tudo, outros veem apenas sua empresa
create policy empresa_admin_select on empresa
  for select
  using (
    exists (
      select 1 from auth.users 
      where auth.users.id = auth.uid() 
      and (
        (auth.users.raw_user_meta_data->>'role' = 'admin')
        or exists (
          select 1 from empresa_users eu 
          where eu.user_id = auth.uid() 
          and eu.empresa_id = empresa.id
        )
      )
    )
  );

-- Policy para INSERT: apenas admin pode criar empresas
create policy empresa_admin_insert on empresa
  for insert
  with check (
    exists (
      select 1 from auth.users 
      where auth.users.id = auth.uid() 
      and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy para UPDATE: apenas admin pode atualizar empresas
create policy empresa_admin_update on empresa
  for update
  using (
    exists (
      select 1 from auth.users 
      where auth.users.id = auth.uid() 
      and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  with check (
    exists (
      select 1 from auth.users 
      where auth.users.id = auth.uid() 
      and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy para DELETE: apenas admin pode deletar empresas
create policy empresa_admin_delete on empresa
  for delete
  using (
    exists (
      select 1 from auth.users 
      where auth.users.id = auth.uid() 
      and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );
