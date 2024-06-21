variable "digitalocean_token" {
  type      = string
  sensitive = true
}

variable "digitalocean_region" {
  type = string
}

variable "digitalocean_project_id" {
  type = string
}

variable "wov_domain" {
  type    = string
  default = "api.worldofv.art"
}

variable "metadata_domain" {
  type    = string
  default = "metadata.worldofv.art"
}

variable "k8s_cluster_node_size" {
  type = string
}

variable "k8s_cluster_node_count_min" {
  type = number
}

variable "k8s_cluster_node_count_max" {
  type = number
}

variable "services_http_port" {
  type    = number
  default = 80
}

variable "services_grpc_port" {
  type    = number
  default = 50051
}

variable "services_environment" {
  type      = map(string)
  sensitive = true
}

variable "services_tag" {
  type = string
}

variable "admin_username" {
  type = string
}

variable "admin_password" {
  type      = string
  sensitive = true
}
