const { DataTypes } = require("sequelize");
const { sequelize } = require("../src/database");

const ScanResult = sequelize.define(
  "ScanResult",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    match: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    productName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    isFromDifferentDate: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    originalDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    tableName: "scan_results",
    timestamps: true,
    indexes: [
      {
        fields: ["date"],
      },
      {
        fields: ["barcode"],
      },
    ],
  }
);

module.exports = ScanResult;
