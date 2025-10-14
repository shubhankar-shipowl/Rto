const { DataTypes } = require('sequelize');
const { sequelize } = require('../src/database');

const Complaint = sequelize.define(
  'Complaint',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'mail_done', 'resolved', 'closed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    mailSubject: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resolution: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'complaints',
    timestamps: true,
    indexes: [
      {
        fields: ['barcode'],
      },
      {
        fields: ['date'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['email'],
      },
    ],
  },
);

module.exports = Complaint;
