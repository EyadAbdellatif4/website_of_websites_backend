'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('designs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      storage_key: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('UPLOADED', 'PROCESSING', 'READY', 'FAILED'),
        allowNull: false,
      },
      layout_data: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      placeholders_data: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('designs', ['user_id'], {
      name: 'idx_designs_user_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('designs', 'idx_designs_user_id');
    await queryInterface.dropTable('designs');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_designs_status";',
    );
  },
};
