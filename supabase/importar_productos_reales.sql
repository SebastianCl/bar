-- Catálogo transcrito de las fotos de precios del bar.
-- Ejecutar una sola vez desde Supabase SQL Editor con permisos de administrador.
-- Cada producto se carga con 50 unidades de stock inicial.
-- La inserción es idempotente por nombre (no modifica productos ya existentes).

begin;

with admin_activo as (
  select id
  from public.profiles
  where role = 'admin' and is_active
  order by created_at
  limit 1
), catalogo (name, current_price) as (
  values
    ('Cerveza Aguila', 4000.00),
    ('Cerveza Pilsen', 4000.00),
    ('Cerveza Club Colombia', 5000.00),
    ('Gatorade', 5000.00),
    ('Smirnoff', 10000.00),
    ('Hit', 4000.00),
    ('Coca-Cola 250 ml', 2000.00),
    ('Agua saborizada 600 ml', 2500.00),
    ('Agua saborizada pequeña', 1500.00),
    ('Speed Max', 3000.00),
    ('Saviloe', 4000.00),
    ('Vive 100', 4000.00),
    ('Soda Pool', 2000.00),
    ('Bretaña', 4000.00),
    ('Manzana 400 ml', 4000.00),
    ('Pepsi 400 ml', 4000.00),
    ('Colombiana 400 ml', 4000.00),
    ('Uva 400 ml', 4000.00),
    ('Lata Cuates', 8000.00),
    ('Malta grande', 3000.00),
    ('Malta pequeña', 2000.00),
    ('Agua grande', 2000.00),
    ('Agua pequeña', 1000.00),
    ('Cola y pola', 4000.00),
    ('Gaseosa Litro 1/4', 7000.00),
    ('De Todito', 4000.00),
    ('Doritos', 3000.00),
    ('Choclitos', 3000.00),
    ('Papas L-N', 3000.00),
    ('Rosquitas', 3000.00),
    ('Boliqueso', 3000.00),
    ('Festival', 3000.00),
    ('Cheese Tris', 3000.00),
    ('Cigarrillo 1/2', 10000.00),
    ('Cigarrillo unidad', 1000.00),
    ('Trident x 5', 2000.00),
    ('Bon Bon Bum', 1000.00),
    ('Alka-Seltzer', 2000.00),
    ('Bomba', 10000.00)
)
insert into public.products (
  name, current_price, stock_quantity, is_active, created_by, updated_by
)
select
  c.name, c.current_price, 50, true, a.id, a.id
from catalogo c
cross join admin_activo a
where not exists (
  select 1 from public.products p where lower(p.name) = lower(c.name)
);

-- Si no hay un perfil administrador activo, el CTE no insertará filas.
commit;

-- Revisión posterior:
-- select name, current_price, stock_quantity from public.products
-- where created_by = (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1)
-- order by name;
