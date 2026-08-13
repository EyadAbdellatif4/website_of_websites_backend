import { Sequelize } from 'sequelize-typescript';
import { User } from '../modules/users/entities/user.entity';
import {
  Design,
  DesignAttributes,
  DesignStatus,
} from '../modules/designs/entities/design.entity';

describe('Database Layer (Sequelize Models & Constraints)', () => {
  let sequelize: Sequelize;

  beforeAll(async () => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      models: [User, Design],
    });
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Design.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });
  });

  it('should successfully create a user with UUID and timestamps', async () => {
    const user = await User.create({
      email: 'test@example.com',
      password_hash: 'hashedpassword123',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.password_hash).toBe('hashedpassword123');
    expect(user.created_at).toBeDefined();
    expect(user.updated_at).toBeDefined();
  });

  it('should enforce email uniqueness constraint', async () => {
    await User.create({
      email: 'unique@example.com',
      password_hash: 'hash1',
    });

    await expect(
      User.create({
        email: 'unique@example.com',
        password_hash: 'hash2',
      }),
    ).rejects.toThrow();
  });

  it('should create a design for a valid user and verify foreign key reference', async () => {
    const user = await User.create({
      email: 'designer@example.com',
      password_hash: 'hash123',
    });

    const design = await Design.create({
      user_id: user.id,
      name: 'Landing Page',
      file_name: 'landing.zip',
      storage_key: 'uploads/landing.zip',
      file_size: 102456,
      status: DesignStatus.UPLOADED,
    });

    expect(design.id).toBeDefined();
    expect(design.user_id).toBe(user.id);
    expect(design.name).toBe('Landing Page');
    expect(design.file_name).toBe('landing.zip');
    expect(design.storage_key).toBe('uploads/landing.zip');
    expect(Number(design.file_size)).toBe(102456);
    expect(design.status).toBe(DesignStatus.UPLOADED);
  });

  it('should fail to create a design without user_id', async () => {
    await expect(
      Design.create({
        name: 'Orphan Design',
        file_name: 'orphan.zip',
        storage_key: 'uploads/orphan.zip',
        file_size: 500,
        status: DesignStatus.UPLOADED,
      } as unknown as DesignAttributes),
    ).rejects.toThrow();
  });

  it('should cascade delete designs when the user is deleted', async () => {
    const user = await User.create({
      email: 'cascade@example.com',
      password_hash: 'hash123',
    });

    await Design.create({
      user_id: user.id,
      name: 'Cascaded Design 1',
      file_name: 'c1.zip',
      storage_key: 'uploads/c1.zip',
      file_size: 100,
      status: DesignStatus.UPLOADED,
    });

    await Design.create({
      user_id: user.id,
      name: 'Cascaded Design 2',
      file_name: 'c2.zip',
      storage_key: 'uploads/c2.zip',
      file_size: 200,
      status: DesignStatus.UPLOADED,
    });

    const initialDesigns = await Design.findAll({
      where: { user_id: user.id },
    });
    expect(initialDesigns.length).toBe(2);

    await user.destroy();

    const remainingDesigns = await Design.findAll({
      where: { user_id: user.id },
    });
    expect(remainingDesigns.length).toBe(0);
  });

  it('should accept JSON data for layout_data and placeholders_data', async () => {
    const user = await User.create({
      email: 'json@example.com',
      password_hash: 'hash123',
    });

    const layout = { sections: [{ type: 'hero', title: 'Welcome' }] };
    const placeholders = [{ id: 'ph_1', type: 'image', label: 'Logo' }];

    const design = await Design.create({
      user_id: user.id,
      name: 'JSON Test Design',
      file_name: 'json.zip',
      storage_key: 'uploads/json.zip',
      file_size: 300,
      status: DesignStatus.READY,
      layout_data: layout,
      placeholders_data: placeholders,
    });

    const fetched = await Design.findByPk(design.id);
    expect(fetched?.layout_data).toEqual(layout);
    expect(fetched?.placeholders_data).toEqual(placeholders);
  });

  it('should only accept valid enum status values', async () => {
    const user = await User.create({
      email: 'enum@example.com',
      password_hash: 'hash123',
    });

    const validDesign = await Design.create({
      user_id: user.id,
      name: 'Valid Status',
      file_name: 'v.zip',
      storage_key: 'uploads/v.zip',
      file_size: 100,
      status: DesignStatus.PROCESSING,
    });

    expect(validDesign.status).toBe(DesignStatus.PROCESSING);

    await expect(
      Design.create({
        user_id: user.id,
        name: 'Invalid Status',
        file_name: 'inv.zip',
        storage_key: 'uploads/inv.zip',
        file_size: 100,
        status: 'INVALID_STATUS' as unknown as DesignStatus,
      }),
    ).rejects.toThrow();
  });
});
