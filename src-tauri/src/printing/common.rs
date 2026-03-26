#[derive(Clone, Copy, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DriverKind {
    EscPosUsb,
    EscPosSystem,
    SystemPrint,
    Preview,
}

#[derive(Clone, Copy)]
pub enum PrintMode {
    Receipt,
    Test,
    Raw,
}
