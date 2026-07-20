import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from "typeorm";
import { Department } from "./Department";
import { Knowledge } from "./Knowledge";

@Entity("categories")
@Unique(["departmentId", "name"])
export class Category {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar", length: 120 }) name!: string;
  @Column({ type: "uuid" }) departmentId!: string;
  @ManyToOne(() => Department, (department) => department.categories, { onDelete: "CASCADE" })
  @JoinColumn({ name: "departmentId" })
  department!: Relation<Department>;
  @OneToMany(() => Knowledge, (knowledge) => knowledge.category) knowledge!: Relation<Knowledge[]>;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
