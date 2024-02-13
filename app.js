const express = require("express");
const cors = require("cors");
const app = express();
const client = require("./db");

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/getProducts", async (req, res) => {
  try {
    const productData = await client.query(
      "SELECT p.id, p.name, b.name AS brand, p.volume, vu.name AS volume_unit, p.amount FROM products p INNER JOIN brand b ON p.brand_id = b.id INNER JOIN volume_unit vu ON p.volume_unit_id = vu.id"
    );

    res.json(productData.rows);
  } catch (err) {
    console.error("Error getting products:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/getShops", async (req, res) => {
  try {
    const allShops = await client.query("SELECT * FROM shops");
    res.json(allShops.rows);
  } catch (err) {
    console.error("Error getting shops:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/getCurrentCart", async (req, res) => {
  try {
    const currentCart = await client.query(`
      SELECT
        cc.id,
        cc.product_id,
        p.name AS product_name,
        b.name AS brand_name,
        cc.quantity,
        p.volume,
        vu.name AS volume_unit_name,
        s.id as shop_id,  
        s.name,
        psp.price
      FROM current_cart AS cc
      JOIN products AS p ON cc.product_id = p.id
      JOIN brand AS b ON p.brand_id = b.id
      JOIN volume_unit AS vu ON p.volume_unit_id = vu.id
      JOIN product_shop_prices psp ON p.id = psp.product_id
      JOIN shops s ON s.id = psp.shop_id
    `);

    res.json(currentCart.rows);
  } catch (err) {
    console.error("Error getting current cart:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/addProduct", async (req, res) => {
  const { name, amount } = req.body;

  try {
    // Check if the product already exists in the current cart
    const existingProduct = await client.query(
      "SELECT * FROM current_cart WHERE product_id = (SELECT id FROM products WHERE name = $1)",
      [name]
    );

    if (existingProduct.rows.length > 0) {
      // If the product already exists, update the quantity
      const newQuantity = existingProduct.rows[0].quantity + amount;
      await client.query(
        "UPDATE current_cart SET quantity = $1 WHERE product_id = (SELECT id FROM products WHERE name = $2)",
        [newQuantity, name]
      );
    } else {
      // If the product doesn't exist, add it to the current_cart
      const product = await client.query(
        "SELECT * FROM products WHERE name = $1",
        [name]
      );

      if (product.rows.length === 0) {
        return res.status(400).json({ error: "Product not found" });
      }

      await client.query(
        "INSERT INTO current_cart (product_id, quantity) VALUES ($1, $2)",
        [product.rows[0].id, amount]
      );
    }

    res.json({ message: "Product added to current cart" });
  } catch (err) {
    console.error("Error adding product to current cart:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/addAmount", async (req, res) => {
  const { productId } = req.body;

  try {
    const existingProduct = await client.query(
      "SELECT * FROM current_cart WHERE product_id = $1",
      [productId]
    );

    if (existingProduct.rows.length === 0) {
      return res.status(400).json({ error: "Product not found in the cart" });
    }

    const newQuantity = existingProduct.rows[0].quantity + 1;

    await client.query(
      "UPDATE current_cart SET quantity = $1 WHERE product_id = $2",
      [newQuantity, productId]
    );

    res.json({ message: "Quantity added to the product in the cart" });
  } catch (err) {
    console.error(
      "Error adding quantity to the product in the cart:",
      err.message
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/decAmount", async (req, res) => {
  const { productId } = req.body;

  try {
    const existingProduct = await client.query(
      "SELECT * FROM current_cart WHERE product_id = $1",
      [productId]
    );

    if (existingProduct.rows.length === 0) {
      return res.status(400).json({ error: "Product not found in the cart" });
    }

    const currentQuantity = existingProduct.rows[0].quantity;

    if (currentQuantity === 1) {
      // Remove the product from the cart if quantity is 1
      await client.query("DELETE FROM current_cart WHERE product_id = $1", [
        productId,
      ]);
    } else {
      const newQuantity = currentQuantity - 1;

      await client.query(
        "UPDATE current_cart SET quantity = $1 WHERE product_id = $2",
        [newQuantity, productId]
      );
    }

    res.json({ message: "Quantity decreased for the product in the cart" });
  } catch (err) {
    console.error(
      "Error decreasing quantity for the product in the cart:",
      err.message
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/removeFromCart", async (req, res) => {
  const { productId } = req.body;

  try {
    const existingProduct = await client.query(
      "SELECT * FROM current_cart WHERE product_id = $1",
      [productId]
    );

    if (existingProduct.rows.length === 0) {
      return res.status(400).json({ error: "Product not found in the cart" });
    }

    await client.query("DELETE FROM current_cart WHERE product_id = $1", [
      productId,
    ]);

    res.json({ message: "Removed the item from the cart" });
  } catch (err) {
    console.error("Error removing the item from the cart:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/addProductToDB", async (req, res) => {
  const { name, brand, amount, volume, measurementUnit, prices } = req.body;

  try {
    // Check if the product already exists in the products table
    const existingProduct = await client.query(
      "SELECT id FROM products WHERE name = $1 AND brand_id = (SELECT id FROM brand WHERE name = $2)",
      [name, brand]
    );

    if (existingProduct.rows.length > 0) {
      // Product already exists, return an error or handle it as needed
      return res.status(400).json({ error: "Product already exists" });
    }

    // Check if the brand already exists in the brand table or get the maximum brandId
    let brandId;
    const existingBrand = await client.query(
      "SELECT id FROM brand WHERE name = $1",
      [brand]
    );

    if (existingBrand.rows.length > 0) {
      brandId = existingBrand.rows[0].id;
    } else {
      // If the brand doesn't exist, get the maximum brandId and increment it by 1
      const maxBrandId = await client.query("SELECT MAX(id) FROM brand");
      brandId = maxBrandId.rows[0].max + 1;

      // Add the new brand to the brand table
      await client.query("INSERT INTO brand (id, name) VALUES ($1, $2)", [
        brandId,
        brand,
      ]);
    }

    // Get the maximum existing productId and increment it by 1
    const maxProductId = await client.query("SELECT MAX(id) FROM products");
    const productId = maxProductId.rows[0].max + 1;

    // Add the product to the products table
    await client.query(
      "INSERT INTO products (id, name, brand_id, amount, volume, volume_unit_id) VALUES ($1, $2, $3, $4, $5, (SELECT id FROM volume_unit WHERE name = $6))",
      [productId, name, brandId, amount, volume, measurementUnit]
    );

    // Get the maximum existing ID from product_shop_prices and increment it by 1
    const maxPriceId = await client.query(
      "SELECT MAX(id) FROM product_shop_prices"
    );
    var nextPriceId = maxPriceId.rows[0].max + 1;

    // Add prices to the product_shop_prices table with the next available ID
    for (const shopId in prices) {
      if (prices.hasOwnProperty(shopId)) {
        const price = prices[shopId];

        await client.query(
          "INSERT INTO product_shop_prices (id, product_id, shop_id, price) VALUES ($1, $2, $3, $4)",
          [nextPriceId, productId, shopId, price]
        );

        // Increment the next available ID
        nextPriceId++;
      }
    }

    res.json({ message: "Product added to the products table with prices" });
  } catch (err) {
    console.error("Error adding product to the products table:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
