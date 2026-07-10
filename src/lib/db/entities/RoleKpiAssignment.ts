import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Role } from "./Role";
import { KpiDefinition } from "./KpiDefinition";

@Entity("role_kpi_assignments")
@Unique(["roleId", "kpiId"])
export class RoleKpiAssignment {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) roleId!: string;
  @ManyToOne(() => Role, (role) => role.kpiAssignments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "roleId" })
  role!: Relation<Role>;
  @Column({ type: "uuid" }) kpiId!: string;
  @ManyToOne(() => KpiDefinition, (kpi) => kpi.roleAssignments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "kpiId" })
  kpi!: Relation<KpiDefinition>;
  @Column({ type: "numeric", precision: 14, scale: 2 }) target!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
