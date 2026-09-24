import type { Product } from '../domain'
import { formatCLP } from '../pos'

function priceUnit(product: Product) {
  if (product.unitType === 'KG') return '/kg'
  if (product.unitType === 'UNIT') return '/un'
  return '/pack'
}

export function Showcase({ products, preview = false }: { products: Product[]; preview?: boolean }) {
  const visible = products
    .filter((product) => product.active && product.showOnShowcase)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const hero = visible.find((product) => product.featured) ?? visible[0]
  const cards = visible.slice(0, 6)
  const emptySlots = Math.max(0, 6 - cards.length)

  return (
    <div className={preview ? 'showcase showcase-preview' : 'showcase'}>
      <header className="showcase-header">
        <div className="showcase-brand"><span>◉</span><b>ORBI</b> SHOWCASE</div>
        <div className="showcase-business"><small>CARNICERÍA</small><strong>EL CHUNCHITO</strong></div>
        <div className="showcase-tagline">CORTES FRESCOS <i /> PRECIOS ACTUALIZADOS</div>
      </header>

      {hero ? (
        <section className="showcase-hero">
          <div className="hero-copy">
            <span className="hero-kicker">DESTACADO</span>
            <div className="hero-code">COD <b>{hero.code}</b></div>
            <h1>{hero.name}</h1>
            <div className="hero-price">{formatCLP(hero.price)}<small>{priceUnit(hero)}</small></div>
          </div>
          <div className="hero-meat">
            {hero.imageUrl ? <img src={hero.imageUrl} alt={hero.name} /> : <span>🥩</span>}
            <b>CARNE FRESCA<br/><small>TODOS LOS DÍAS</small></b>
          </div>
        </section>
      ) : null}

      <section className="showcase-grid">
        {cards.map((product) => (
          <article className="showcase-card" key={product.id}>
            <div className="showcase-card-code">COD <b>{product.code}</b></div>
            <div className="showcase-card-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>🥩</span>}</div>
            <h2>{product.name}</h2>
            <div className="showcase-card-price">{formatCLP(product.price)}<small>{priceUnit(product)}</small></div>
          </article>
        ))}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <article className="showcase-card showcase-slot" key={index}>
            <div className="showcase-card-image"><span>＋</span></div>
            <h2>Producto por cargar</h2>
            <div className="showcase-card-price">—</div>
          </article>
        ))}
      </section>

      <footer className="showcase-footer">
        <span>◉ CARNICERÍA EL CHUNCHITO</span>
        <span>🐄 CORTES SELECCIONADOS</span>
        <span>✦ FRESCURA Y CALIDAD</span>
        <span>PRECIOS VISIBLES · PEDIDOS MÁS RÁPIDOS</span>
      </footer>
    </div>
  )
}
