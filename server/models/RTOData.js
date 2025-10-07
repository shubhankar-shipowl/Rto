const { DataTypes } = require("sequelize");
const { sequelize } = require("../src/database");

const RTOData = sequelize.define(
  "RTOData",
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
    barcodes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    uploadInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    reconciliationSummary: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        totalScanned: 0,
        matched: 0,
        unmatched: 0,
      },
    },
  },
  {
    tableName: "rto_data",
    timestamps: true,
    indexes: [
      {
        fields: ["date"],
      },
    ],
  }
);

module.exports = RTOData;
