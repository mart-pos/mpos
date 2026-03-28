#![allow(dead_code)]

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptDocument {
    pub paper_width_mm: u16,
    #[serde(alias = "contentBlocks", alias = "content")]
    pub content_blocks: Vec<ReceiptBlock>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ReceiptBlock {
    Text { value: String, align: String, bold: bool },
    Image {
        data: String,
        align: Option<String>,
        #[serde(alias = "maxWidth")]
        max_width: Option<u16>,
    },
    Divider,
    Item {
        name: String,
        qty: u32,
        #[serde(alias = "unitPrice")]
        unit_price: ReceiptAmount,
        total: ReceiptAmount,
    },
    Totals {
        subtotal: ReceiptAmount,
        tax: ReceiptAmount,
        #[serde(alias = "grandTotal")]
        grand_total: ReceiptAmount,
    },
    Qr { value: String },
    Barcode {
        value: String,
        symbology: Option<String>,
        height: Option<u8>,
        #[serde(default = "default_true")]
        #[serde(alias = "showText")]
        show_text: bool,
        #[serde(default)]
        #[serde(alias = "fullWidth")]
        full_width: bool,
    },
    CashDrawer,
    Cut,
}

impl ReceiptDocument {
    pub fn validate(&self) -> Result<(), String> {
        if !matches!(self.paper_width_mm, 58 | 80) {
            return Err("paper_width_mm must be 58 or 80".into());
        }

        if self.content_blocks.is_empty() {
            return Err("receipt content cannot be empty".into());
        }

        if self.content_blocks.len() > 256 {
            return Err("receipt content exceeds maximum block count".into());
        }

        for block in &self.content_blocks {
            match block {
                ReceiptBlock::Text { value, align, .. } => {
                    validate_text(value, 512, "text")?;
                    if !matches!(align.as_str(), "left" | "center" | "right") {
                        return Err("text align must be left, center or right".into());
                    }
                }
                ReceiptBlock::Image {
                    data,
                    align,
                    max_width,
                } => {
                    validate_text(data, 256_000, "image data")?;
                    if let Some(align) = align {
                        if !matches!(align.as_str(), "left" | "center" | "right") {
                            return Err("image align must be left, center or right".into());
                        }
                    }
                    if let Some(max_width) = max_width {
                        if *max_width == 0 {
                            return Err("image max_width must be greater than zero".into());
                        }
                    }
                }
                ReceiptBlock::Divider | ReceiptBlock::CashDrawer | ReceiptBlock::Cut => {}
                ReceiptBlock::Item {
                    name,
                    qty,
                    unit_price,
                    total,
                } => {
                    validate_text(name, 128, "item name")?;
                    if *qty == 0 {
                        return Err("item qty must be greater than zero".into());
                    }
                    unit_price.validate("item unit_price")?;
                    total.validate("item total")?;
                    if let (Some(total), Some(unit_price)) =
                        (total.as_numeric(), unit_price.as_numeric())
                    {
                        if total < unit_price {
                            return Err("item total cannot be lower than unit_price".into());
                        }
                    }
                }
                ReceiptBlock::Totals {
                    subtotal,
                    tax,
                    grand_total,
                } => {
                    subtotal.validate("subtotal")?;
                    tax.validate("tax")?;
                    grand_total.validate("grand_total")?;
                    if let (Some(subtotal), Some(tax), Some(grand_total)) = (
                        subtotal.as_numeric(),
                        tax.as_numeric(),
                        grand_total.as_numeric(),
                    ) {
                        if subtotal.saturating_add(tax) > grand_total {
                            return Err("grand_total cannot be lower than subtotal + tax".into());
                        }
                    }
                }
                ReceiptBlock::Qr { value } => {
                    validate_text(value, 512, "qr value")?;
                }
                ReceiptBlock::Barcode {
                    value,
                    symbology,
                    height,
                    ..
                } => {
                    validate_text(value, 128, "barcode value")?;
                    if let Some(symbology) = symbology {
                        if !matches!(
                            symbology.as_str(),
                            "code128" | "code39" | "ean13" | "ean8" | "upca" | "upce" | "itf"
                        ) {
                            return Err("unsupported barcode symbology".into());
                        }
                    }
                    if let Some(height) = height {
                        if *height < 1 {
                            return Err("barcode height must be greater than zero".into());
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
pub enum ReceiptAmount {
    Number(u64),
    Text(String),
}

impl ReceiptAmount {
    pub fn as_numeric(&self) -> Option<u64> {
        match self {
            Self::Number(value) => Some(*value),
            Self::Text(_) => None,
        }
    }

    pub fn as_display(&self) -> String {
        match self {
            Self::Number(value) => value.to_string(),
            Self::Text(value) => value.clone(),
        }
    }

    pub fn validate(&self, label: &str) -> Result<(), String> {
        match self {
            Self::Number(_) => Ok(()),
            Self::Text(value) => validate_text(value, 64, label),
        }
    }
}

fn default_true() -> bool {
    true
}

fn validate_text(value: &str, max_len: usize, label: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{label} cannot be empty"));
    }

    if value.len() > max_len {
        return Err(format!("{label} exceeds maximum length"));
    }

    if value
        .chars()
        .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
    {
        return Err(format!("{label} contains unsupported control characters"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_alignment() {
        let document = ReceiptDocument {
            paper_width_mm: 80,
            content_blocks: vec![ReceiptBlock::Text {
                value: "hola".into(),
                align: "justify".into(),
                bold: false,
            }],
        };

        assert!(document.validate().is_err());
    }
}
