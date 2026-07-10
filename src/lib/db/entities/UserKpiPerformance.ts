import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { KpiDefinition } from "./KpiDefinition";

@Entity("user_kpi_performance")
@Unique(["userId", "kpiId", "period"])
@Index(["userId", "period"])
export class UserKpiPerformance {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) userId!: string;
  @ManyToOne(() => User, (user) => user.performances, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: Relation<User>;
  @Column({ type: "uuid" }) kpiId!: string;
  @ManyToOne(() => KpiDefinition, (kpi) => kpi.performances, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "kpiId" })
  kpi!: Relation<KpiDefinition>;
  @Column({ type: "date" }) period!: string;
  @Column({ type: "numeric", precision: 14, scale: 2 }) current!: string;
  @Column({ type: "numeric", precision: 14, scale: 2 }) target!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
