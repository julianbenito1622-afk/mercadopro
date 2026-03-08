-- ============================================================
-- MERCADOPRO — Schema SQLite Local v1
-- IDs: TEXT (crypto.randomUUID() en cliente)
-- Montos: REAL (precisión manejada en app)
-- Booleanos: INTEGER (0/1)
-- Fechas: TEXT (ISO 8601)
-- Todas las tablas: sync_status, created_at, updated_at
-- ============================================================

-- ── NEGOCIO ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business (
  id                TEXT PRIMARY KEY,
  nombre            TEXT NOT NULL,
  ruc               TEXT,
  rubro             TEXT NOT NULL DEFAULT 'ALIMENTOS_PERECEDEROS',
  plan              TEXT NOT NULL DEFAULT 'FREE',
  mercado           TEXT,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ── SUCURSAL ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL REFERENCES business(id),
  nombre            TEXT NOT NULL,
  ubicacion         TEXT,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_branch_business ON branch(business_id);

-- ── USUARIO ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_user (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL REFERENCES business(id),
  branch_id         TEXT REFERENCES branch(id),
  nombre            TEXT NOT NULL,
  celular           TEXT NOT NULL,
  pin               TEXT NOT NULL,
  rol               TEXT NOT NULL DEFAULT 'VENDEDOR',
  activo            INTEGER NOT NULL DEFAULT 1,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_business ON app_user(business_id);

-- ── CATEGORÍA ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS category (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL REFERENCES business(id),
  nombre            TEXT NOT NULL,
  orden             INTEGER NOT NULL DEFAULT 0,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_category_business ON category(business_id);

-- ── PRODUCTO ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product (
  id                    TEXT PRIMARY KEY,
  business_id           TEXT NOT NULL REFERENCES business(id),
  category_id           TEXT NOT NULL REFERENCES category(id),
  nombre                TEXT NOT NULL,
  nombre_corto          TEXT NOT NULL,
  unidad_venta_principal TEXT NOT NULL DEFAULT 'KG',
  unidad_base           TEXT NOT NULL DEFAULT 'KG',
  precio_venta_actual   REAL NOT NULL DEFAULT 0,
  requiere_pesaje       INTEGER NOT NULL DEFAULT 1,
  vida_util_dias        INTEGER NOT NULL DEFAULT 7,
  activo                INTEGER NOT NULL DEFAULT 1,
  es_pantalla_rapida    INTEGER NOT NULL DEFAULT 0,
  orden_pantalla        INTEGER NOT NULL DEFAULT 0,
  imagen_url            TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'LOCAL',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_business  ON product(business_id);
CREATE INDEX IF NOT EXISTS idx_product_category  ON product(category_id);

-- ── TIPO DE ENVASE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS container_type (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL REFERENCES business(id),
  nombre            TEXT NOT NULL,
  peso_tara_kg      REAL NOT NULL DEFAULT 0,
  descripcion       TEXT,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_container_business ON container_type(business_id);

-- ── PRODUCTO_UNIDAD (conversiones) ──────────────────────────
CREATE TABLE IF NOT EXISTS product_unit (
  product_id        TEXT NOT NULL REFERENCES product(id),
  unidad            TEXT NOT NULL,
  equivalencia_kg   REAL NOT NULL,
  es_peso_variable  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, unidad)
);

-- ── PROVEEDOR ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier (
  id                      TEXT PRIMARY KEY,
  business_id             TEXT NOT NULL REFERENCES business(id),
  nombre                  TEXT NOT NULL,
  celular                 TEXT,
  tipo                    TEXT NOT NULL DEFAULT 'DIRECTO',
  zona_origen             TEXT,
  comision_consignacion   REAL,
  sync_status             TEXT NOT NULL DEFAULT 'LOCAL',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supplier_business ON supplier(business_id);

-- ── LOTE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batch (
  id                          TEXT PRIMARY KEY,
  business_id                 TEXT NOT NULL REFERENCES business(id),
  branch_id                   TEXT NOT NULL REFERENCES branch(id),
  product_id                  TEXT NOT NULL REFERENCES product(id),
  supplier_id                 TEXT REFERENCES supplier(id),
  tipo_ingreso                TEXT NOT NULL DEFAULT 'COMPRA_DIRECTA',
  fecha_entrada               TEXT NOT NULL,
  cantidad_inicial_kg         REAL NOT NULL DEFAULT 0,
  cantidad_actual_kg          REAL NOT NULL DEFAULT 0,
  costo_unitario              REAL NOT NULL DEFAULT 0,
  costo_total                 REAL NOT NULL DEFAULT 0,
  envases_cantidad            INTEGER NOT NULL DEFAULT 0,
  envase_tipo_id              TEXT REFERENCES container_type(id),
  fecha_vencimiento_estimada  TEXT NOT NULL,
  estado                      TEXT NOT NULL DEFAULT 'FRESCO',
  alerta_merma_dias           INTEGER NOT NULL DEFAULT 2,
  notas                       TEXT,
  sync_status                 TEXT NOT NULL DEFAULT 'LOCAL',
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_batch_business ON batch(business_id);
CREATE INDEX IF NOT EXISTS idx_batch_product  ON batch(product_id);

-- ── MOVIMIENTO DE STOCK ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movement (
  id                TEXT PRIMARY KEY,
  batch_id          TEXT NOT NULL REFERENCES batch(id),
  tipo              TEXT NOT NULL,
  cantidad_kg       REAL NOT NULL,
  motivo            TEXT,
  sale_item_id      TEXT,
  registrado_por    TEXT NOT NULL,
  fecha             TEXT NOT NULL,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_movement_batch ON stock_movement(batch_id);

-- ── CLIENTE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL REFERENCES business(id),
  nombre            TEXT NOT NULL,
  nombre_corto      TEXT NOT NULL,
  celular           TEXT,
  tipo              TEXT NOT NULL DEFAULT 'MINORISTA',
  dni_ruc           TEXT,
  direccion         TEXT,
  es_frecuente      INTEGER NOT NULL DEFAULT 0,
  orden_pantalla    INTEGER NOT NULL DEFAULT 0,
  activo            INTEGER NOT NULL DEFAULT 1,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_business ON client(business_id);

-- ── PERFIL DE CRÉDITO ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_profile (
  id                        TEXT PRIMARY KEY,
  client_id                 TEXT NOT NULL UNIQUE REFERENCES client(id),
  limite_credito            REAL NOT NULL DEFAULT 0,
  plazo_dias                INTEGER NOT NULL DEFAULT 3,
  saldo_actual              REAL NOT NULL DEFAULT 0,
  score                     INTEGER NOT NULL DEFAULT 100,
  estado                    TEXT NOT NULL DEFAULT 'ACTIVO',
  fecha_ultimo_pago         TEXT,
  total_historico_credito   REAL NOT NULL DEFAULT 0,
  total_historico_pagado    REAL NOT NULL DEFAULT 0,
  veces_moroso              INTEGER NOT NULL DEFAULT 0,
  sync_status               TEXT NOT NULL DEFAULT 'LOCAL',
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);

-- ── VENTA ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale (
  id                          TEXT PRIMARY KEY,
  business_id                 TEXT NOT NULL REFERENCES business(id),
  branch_id                   TEXT NOT NULL REFERENCES branch(id),
  user_id                     TEXT NOT NULL,
  client_id                   TEXT REFERENCES client(id),
  numero_ticket               TEXT NOT NULL,
  fecha                       TEXT NOT NULL,
  subtotal                    REAL NOT NULL DEFAULT 0,
  descuento                   REAL NOT NULL DEFAULT 0,
  total                       REAL NOT NULL DEFAULT 0,
  metodo_pago                 TEXT NOT NULL DEFAULT 'EFECTIVO',
  estado_pago                 TEXT NOT NULL DEFAULT 'PAGADO',
  monto_pagado                REAL NOT NULL DEFAULT 0,
  monto_pendiente             REAL NOT NULL DEFAULT 0,
  fecha_vencimiento_credito   TEXT,
  notas                       TEXT,
  sync_status                 TEXT NOT NULL DEFAULT 'LOCAL',
  device_id                   TEXT NOT NULL,
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_business ON sale(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_client   ON sale(client_id);
CREATE INDEX IF NOT EXISTS idx_sale_fecha    ON sale(fecha);

-- ── DETALLE DE VENTA ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_item (
  id                TEXT PRIMARY KEY,
  sale_id           TEXT NOT NULL REFERENCES sale(id),
  product_id        TEXT NOT NULL REFERENCES product(id),
  batch_id          TEXT REFERENCES batch(id),
  cantidad          REAL NOT NULL,
  unidad_venta      TEXT NOT NULL DEFAULT 'KG',
  peso_bruto_kg     REAL NOT NULL DEFAULT 0,
  peso_tara_kg      REAL NOT NULL DEFAULT 0,
  peso_neto_kg      REAL NOT NULL DEFAULT 0,
  precio_unitario   REAL NOT NULL,
  subtotal          REAL NOT NULL,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_item_sale    ON sale_item(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_item_product ON sale_item(product_id);

-- ── PAGO ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES client(id),
  sale_id           TEXT REFERENCES sale(id),
  monto             REAL NOT NULL,
  metodo            TEXT NOT NULL,
  fecha             TEXT NOT NULL,
  referencia        TEXT,
  notas             TEXT,
  registrado_por    TEXT NOT NULL,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_client ON payment(client_id);

-- ── CONSIGNACIÓN ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consignment (
  id                    TEXT PRIMARY KEY,
  business_id           TEXT NOT NULL REFERENCES business(id),
  supplier_id           TEXT NOT NULL REFERENCES supplier(id),
  fecha_recepcion       TEXT NOT NULL,
  estado                TEXT NOT NULL DEFAULT 'ABIERTA',
  cantidad_recibida_kg  REAL NOT NULL DEFAULT 0,
  cantidad_vendida_kg   REAL NOT NULL DEFAULT 0,
  cantidad_merma_kg     REAL NOT NULL DEFAULT 0,
  monto_total_ventas    REAL NOT NULL DEFAULT 0,
  comision_porcentaje   REAL NOT NULL DEFAULT 0,
  comision_monto        REAL NOT NULL DEFAULT 0,
  otros_descuentos      REAL NOT NULL DEFAULT 0,
  monto_a_pagar         REAL NOT NULL DEFAULT 0,
  fecha_liquidacion     TEXT,
  notas                 TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'LOCAL',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consignment_business ON consignment(business_id);

-- ── LOTE_CONSIGNACIÓN ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consignment_batch (
  consignment_id    TEXT NOT NULL REFERENCES consignment(id),
  batch_id          TEXT NOT NULL REFERENCES batch(id),
  PRIMARY KEY (consignment_id, batch_id)
);

-- ── HISTORIAL DE PRECIOS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES product(id),
  precio_anterior   REAL NOT NULL,
  precio_nuevo      REAL NOT NULL,
  fecha             TEXT NOT NULL,
  registrado_por    TEXT NOT NULL,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);

-- ── DOCUMENTO TRIBUTARIO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_document (
  id                TEXT PRIMARY KEY,
  sale_id           TEXT NOT NULL UNIQUE REFERENCES sale(id),
  tipo              TEXT NOT NULL DEFAULT 'NINGUNO',
  serie             TEXT,
  numero            TEXT,
  sunat_status      TEXT NOT NULL DEFAULT 'NO_REQUERIDO',
  ubl_xml           TEXT,
  hash_cdr          TEXT,
  fecha_envio       TEXT,
  sync_status       TEXT NOT NULL DEFAULT 'LOCAL',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ── CONFIGURACIÓN ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL REFERENCES business(id),
  clave             TEXT NOT NULL,
  valor             TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_config_business_clave ON configuracion(business_id, clave);

-- ── SYNC LOG ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id                  TEXT PRIMARY KEY,
  device_id           TEXT NOT NULL,
  tabla               TEXT NOT NULL,
  registro_id         TEXT NOT NULL,
  operacion           TEXT NOT NULL,
  datos_json          TEXT NOT NULL,
  timestamp_local     TEXT NOT NULL,
  timestamp_servidor  TEXT,
  estado              TEXT NOT NULL DEFAULT 'PENDIENTE',
  intentos            INTEGER NOT NULL DEFAULT 0,
  error               TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_log_estado ON sync_log(estado);

-- ── COLA DE CONFLICTOS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conflict_queue (
  id                TEXT PRIMARY KEY,
  device_id         TEXT NOT NULL,
  tabla             TEXT NOT NULL,
  registro_id       TEXT NOT NULL,
  datos_local       TEXT NOT NULL,
  datos_servidor    TEXT NOT NULL,
  campo_conflicto   TEXT,
  estado            TEXT NOT NULL DEFAULT 'PENDIENTE',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conflict_queue_estado ON conflict_queue(estado);

-- ============================================================
-- DATOS INICIALES (idempotentes con INSERT OR IGNORE)
-- ============================================================

-- Negocio local por defecto (usado antes de crear cuenta)
INSERT OR IGNORE INTO business (id, nombre, plan, sync_status, created_at, updated_at)
VALUES ('local', 'Mi Negocio', 'FREE', 'LOCAL', datetime('now'), datetime('now'));

-- Sucursal principal local (requerida por sale.branch_id NOT NULL)
INSERT OR IGNORE INTO branch (id, business_id, nombre, sync_status, created_at, updated_at)
VALUES ('local-branch', 'local', 'Principal', 'LOCAL', datetime('now'), datetime('now'));

-- Correlativo de tickets de venta
INSERT OR IGNORE INTO configuracion (id, business_id, clave, valor, created_at, updated_at)
VALUES ('cfg-correlativo', 'local', 'correlativo_venta', '0', datetime('now'), datetime('now'));

-- Categorías de productos por defecto
INSERT OR IGNORE INTO category (id, business_id, nombre, orden, sync_status, created_at, updated_at) VALUES
  ('cat-tuberculos', 'local', 'Tubérculos', 1, 'LOCAL', datetime('now'), datetime('now')),
  ('cat-frutas',     'local', 'Frutas',     2, 'LOCAL', datetime('now'), datetime('now')),
  ('cat-verduras',   'local', 'Verduras',   3, 'LOCAL', datetime('now'), datetime('now')),
  ('cat-carnes',     'local', 'Carnes',     4, 'LOCAL', datetime('now'), datetime('now')),
  ('cat-otros',      'local', 'Otros',      5, 'LOCAL', datetime('now'), datetime('now'));

-- Sin datos de prueba: cada negocio ingresa sus propios productos, clientes y proveedores.
