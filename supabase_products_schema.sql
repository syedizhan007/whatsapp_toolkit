-- Products Table Schema for WhatsApp Toolkit
-- This table stores the dynamic product inventory with prices

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    price_pkr NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_products_item_name ON products(item_name);

-- Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on products" ON products
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional - remove if not needed)
INSERT INTO products (item_name, price_pkr) VALUES
    ('Basic Package', 5000.00),
    ('Premium Package', 15000.00),
    ('Enterprise Package', 50000.00)
ON CONFLICT DO NOTHING;
