import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { RoleKpiAssignment } from "./RoleKpiAssignment";

@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar", length: 120, unique: true }) title!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
  @OneToMany(() => User, (user) => user.role) users!: Relation<User[]>;
  @OneToMany(() => RoleKpiAssignment, (assignment) => assignment.role)
  kpiAssignments!: Relation<RoleKpiAssignment[]>;
}
