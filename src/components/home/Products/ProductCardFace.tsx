import type { CatalogProduct } from "@/lib/api/home";

type Props = {
    card: CatalogProduct;
    className?: string;
};

/** Shared product card face — used by Products cascade and Tunnel Gallery. */
export default function ProductCardFace({ card, className = "" }: Props) {
    return (
        <div className={`products_card_inner${className ? ` ${className}` : ""}`}>
            <div className="products_card_media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.img} alt="" className="products_card_img" />
            </div>

            <div className="products_card_body">
                <div className="products_card_head">
                    <div className="products_card_head_main">
                        <span className={`products_card_status is_${card.statusTone}`}>
                            <i></i>
                            {card.status}
                        </span>

                        <div className="products_card_title_row">
                            <div>
                                <h3 className="products_card_title">{card.title}</h3>
                                {card.tagline ? <p className="products_card_tagline">{card.tagline}</p> : null}
                            </div>

                            <div className="products_card_logo" aria-hidden="true">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={card.logo} alt="" />
                            </div>
                        </div>
                    </div>
                </div>

                {card.problem || card.users ? (
                    <div className="products_card_meta">
                        {card.problem ? (
                            <div className="products_card_meta_item">
                                <span className="products_card_meta_label">{card.problemLabel}</span>
                                <p className="products_card_meta_text">{card.problem}</p>
                            </div>
                        ) : null}
                        {card.users ? (
                            <div className="products_card_meta_item">
                                <span className="products_card_meta_label">{card.usersLabel}</span>
                                <p className="products_card_meta_text">{card.users}</p>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <span className="products_card_sheen" aria-hidden="true"></span>
        </div>
    );
}
