resource "kubernetes_namespace" "wov_namespace" {
  metadata { name = "world-of-v" }
}

# All of the environment variables for the services are stored here.
resource "kubernetes_secret" "services_environment" {
  metadata {
    namespace = kubernetes_namespace.wov_namespace.metadata[0].name
    name      = "services-environment"
  }

  data = var.services_environment
}

# We inject docker credentials instead of using the digitalocean integration
# to be able to deploy from scratch without manual intervention.
resource "kubernetes_secret" "docker_credentials" {
  metadata {
    namespace = kubernetes_namespace.wov_namespace.metadata[0].name
    name      = "docker-credentials"
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "registry.digitalocean.com" = {
          "auth" = base64encode("${var.digitalocean_token}:${var.digitalocean_token}")
        }
      }
    })
  }
}

locals {
  api_fqdn = join(".", [terraform.workspace, data.digitalocean_domain.wov_domain.name])
}

resource "kubernetes_ingress_v1" "services_ingress" {
  wait_for_load_balancer = true

  metadata {
    namespace = kubernetes_namespace.wov_namespace.metadata[0].name
    name      = "wov-ingress"
    annotations = {
      "cert-manager.io/cluster-issuer"                 = "letsencrypt-issuer"
      "nginx.ingress.kubernetes.io/proxy-read-timeout" = "300"
      "nginx.ingress.kubernetes.io/proxy-body-size"    = "50M"
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = [local.api_fqdn, data.digitalocean_domain.metadata_domain.name]
      secret_name = "letsencrypt-tls-secret-wov"
    }

    rule {
      host = local.api_fqdn

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.wov_services["gateway"].metadata[0].name
              port { number = var.services_http_port }
            }
          }
        }
      }
    }

    rule {
      host = data.digitalocean_domain.metadata_domain.name

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.wov_services["metadata"].metadata[0].name
              port { number = var.services_http_port }
            }
          }
        }
      }
    }
  }
}

locals {
  services = {
    "activity" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "256Mi"
    }

    "admin" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "256Mi"
    }

    "auction" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "256Mi"
    }

    "auth" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "256Mi"
    }

    "blockchain-stats" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "384Mi"
    }

    "blockchain-sync-auction" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "384Mi"
    }

    "blockchain-sync-nft" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "384Mi"
    }

    "blockchain-sync-offer" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "384Mi"
    }

    "blockchain-sync-pfp" : {
      replicas : 1
      requests_cpu : "200m"
      limit_mem : "512Mi"
    }

    "blockchain-sync-sale" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "384Mi"
    }

    "blockchain-sync-stake" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "384Mi"
    }

    "blockchain-sync-user" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "384Mi"
    }

    "business" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "128Mi"
    }

    "email" : {
      replicas : 1
      requests_cpu : "50m"
      limit_mem : "256Mi"
    }

    "gateway" : {
      replicas : 2
      requests_cpu : "200m"
      limit_mem : "1Gi"
    }

    "image-thumbnail" : {
      replicas : 2
      requests_cpu : "2"
      limit_mem : "4Gi"
    }

    "marketplace" : {
      replicas : 4
      requests_cpu : "200m"
      limit_mem : "512Mi"
    }

    "marketplace-sync" : {
      replicas : 1
      requests_cpu : "400m"
      limit_mem : "768Mi"
    }

    "metadata" : {
      replicas : 1
      requests_cpu : "50m"
      limit_mem : "128Mi"
    }

    "nft" : {
      replicas : 4
      requests_cpu : "200m"
      limit_mem : "768Mi"
    }

    "nft-import" : {
      replicas : 1
      requests_cpu : "400m"
      limit_mem : "768Mi"
    }

    "offer" : {
      replicas : 4
      requests_cpu : "200m"
      limit_mem : "768Mi"
    }

    "price-conversion" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "256Mi"
    }

    "sale" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "256Mi"
    }

    "user" : {
      replicas : 1
      requests_cpu : "200m"
      limit_mem : "256Mi"
    }

    "aplos-stats" : {
      replicas : 1
      requests_cpu : "100m"
      limit_mem : "256Mi"
    }
  }
}

resource "kubernetes_deployment" "wov_deployments" {
  for_each = local.services

  metadata {
    namespace = kubernetes_namespace.wov_namespace.metadata[0].name
    name      = "wov-deployment-${each.key}"
    labels    = { app : each.key }
  }

  spec {
    replicas = each.value.replicas

    strategy {
      type = "RollingUpdate"

      rolling_update {
        max_surge       = "10%"
        max_unavailable = "75%"
      }
    }

    selector { match_labels = { app : each.key } }

    template {
      metadata { labels = { app : each.key } }

      spec {
        image_pull_secrets {
          name = kubernetes_secret.docker_credentials.metadata[0].name
        }

        container {
          name  = each.key
          image = "registry.digitalocean.com/thor-node/${each.key}:${var.services_tag}"

          env {
            # Jaeger is deployed as a DaemonSet, so we need to inject the host 
            # IP address as Jaeger host since the service is not running on
            # localhost.
            name = "OTEL_EXPORTER_JAEGER_AGENT_HOST"

            value_from {
              field_ref { field_path = "status.hostIP" }
            }
          }

          env {
            name  = "BASE_URL"
            value = "https://${local.api_fqdn}"
          }

          env_from {
            secret_ref { name = kubernetes_secret.services_environment.metadata[0].name }
          }

          port { container_port = var.services_http_port }
          port { container_port = var.services_grpc_port }

          resources {
            requests = { cpu = each.value.requests_cpu }
            limits   = { memory = each.value.limit_mem }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "wov_services" {
  for_each = local.services

  metadata {
    namespace = kubernetes_namespace.wov_namespace.metadata[0].name
    name      = "wov-service-${each.key}"

    annotations = {
      "prometheus.io/scrape" = "true"
      "prometheus.io/path"   = "/metrics"
      "prometheus.io/port"   = var.services_http_port
    }
  }

  spec {
    selector   = { app : each.key }
    cluster_ip = "None"

    port {
      name = "http"
      port = var.services_http_port
    }

    port {
      name = "grpc"
      port = var.services_grpc_port
    }
  }
}
