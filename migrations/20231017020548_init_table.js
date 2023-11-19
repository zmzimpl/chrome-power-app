/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('tag', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('color').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('group', table => {
      table.increments('id').primary().unique();
      table.string('name').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('proxy', table => {
      table.increments('id').primary().unique();
      table.string('ip').nullable();
      table.string('proxy').notNullable();
      table.string('proxy_type').notNullable();
      table.string('ip_checker').nullable();
      table.string('ip_country').nullable();
      table.json('remark').defaultTo(null);
      table.json('check_result').defaultTo(null);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('checked_at').defaultTo(null).nullable();
    })
    .createTable('window', table => {
      table.increments('id').primary().unique();
      table.integer('group_id').references('id').inTable('group').nullable();
      table.integer('proxy_id').references('id').inTable('group').nullable();
      table.json('tags').nullable();
      table.string('name').nullable();
      table.string('remark').nullable();
      table.json('cookie').nullable();
      table.string('ua').nullable();
      table.integer('status').defaultTo(1);
      table.integer('port').defaultTo(null);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(null).nullable();
      table.timestamp('opened_at').defaultTo(null).nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('tag').dropTable('group').dropTable('proxy').dropTable('window');
};
