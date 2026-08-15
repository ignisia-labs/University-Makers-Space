import type { Booking, Equipment, Event, Notification, Project, User } from "@prisma/client";

export const userDto = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  roles: u.roles,
  avatarUrl: u.avatarUrl,
  isActive: u.isActive,
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
});

export const equipmentDto = (e: Equipment) => ({
  id: e.id,
  name: e.name,
  description: e.description,
  category: e.category,
  status: e.status,
  imageUrl: e.imageUrl,
  totalQuantity: e.totalQuantity,
  availableQuantity: e.availableQuantity,
  specs: e.specs,
  visible: e.visible,
  createdAt: e.createdAt.toISOString(),
  updatedAt: e.updatedAt.toISOString(),
});

export const bookingDto = (b: Booking) => ({
  id: b.id,
  userId: b.userId,
  equipmentId: b.equipmentId,
  startTime: b.startTime.toISOString(),
  endTime: b.endTime.toISOString(),
  status: b.status,
  notes: b.notes,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

export const projectDto = (p: Project) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  creatorId: p.creatorId,
  status: p.status,
  tags: p.tags,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export const eventDto = (e: Event) => ({
  id: e.id,
  title: e.title,
  description: e.description,
  organizerId: e.organizerId,
  location: e.location,
  startTime: e.startTime.toISOString(),
  endTime: e.endTime.toISOString(),
  capacity: e.capacity,
  createdAt: e.createdAt.toISOString(),
  updatedAt: e.updatedAt.toISOString(),
});

export const notificationDto = (n: Notification) => ({
  id: n.id,
  userId: n.userId,
  type: n.type,
  message: n.message,
  isRead: n.isRead,
  createdAt: n.createdAt.toISOString(),
});
