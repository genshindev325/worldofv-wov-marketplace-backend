resource "helm_release" "prometheus" {
  name             = "prometheus"
  namespace        = "prometheus"
  create_namespace = true
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "prometheus"
  version          = "19.3.3"

  values = [
    yamlencode({
      "server" = {
        resources = {
          requests = { cpu = "200m" }
          limits   = { memory = "1Gi" }
        }
      }
    })
  ]
}

resource "kubernetes_secret" "grafana_auth" {
  metadata {
    namespace = "grafana"
    name      = "grafana-auth"
  }

  data = {
    "admin-user" : var.admin_username
    "admin-password" : var.admin_password
  }
}

locals {
  grafana_api_fqdn = join(".", [terraform.workspace, "grafana", data.digitalocean_domain.wov_domain.name])
}

resource "helm_release" "grafana" {
  name             = "grafana"
  namespace        = kubernetes_secret.grafana_auth.metadata[0].namespace
  create_namespace = true
  repository       = "https://grafana.github.io/helm-charts"
  chart            = "grafana"
  version          = "6.42.2"

  values = [
    yamlencode({
      "grafana.ini" = {
        "server" = {
          "domain" : local.grafana_api_fqdn
        }
      }

      "admin" : {
        "existingSecret" : kubernetes_secret.grafana_auth.metadata[0].name
      }

      "datasources" = {
        "datasources.yaml" = {
          "apiVersion" = 1

          "datasources" = [
            {
              "name"      = "Prometheus"
              "type"      = "prometheus"
              "access"    = "proxy"
              "url"       = "http://prometheus-server.prometheus"
              "isDefault" = true
              "editable"  = false
            }
          ]
        }
      }

      "dashboardProviders" = {
        "dashboardproviders.yaml" = {
          "apiVersion" = 1

          "providers" = [
            {
              "name"            = "default"
              "orgId"           = 1
              "folder"          = ""
              "type"            = "file"
              "disableDeletion" = true
              "editable"        = true
              "options"         = { "path" = "/var/lib/grafana/dashboards/default" }
            }
          ]
        }
      }

      "dashboards" = {
        "default" = {
          "k8s-views-global" : { json = file("dashboards/k8s-views-global.json") }
          "k8s-views-namespaces" : { json = file("dashboards/k8s-views-namespaces.json") }
          "k8s-views-nodes" : { json = file("dashboards/k8s-views-nodes.json") }
          "k8s-views-pods" : { json = file("dashboards/k8s-views-pods.json") }
          "prisma-metrics" : { json = file("dashboards/prisma-metrics.json") }
        }
      }
    })
  ]
}

resource "kubernetes_ingress_v1" "grafana_ingress" {
  wait_for_load_balancer = true

  metadata {
    namespace   = helm_release.grafana.namespace
    name        = "grafana-ingress"
    annotations = { "cert-manager.io/cluster-issuer" = "letsencrypt-issuer" }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = [local.grafana_api_fqdn]
      secret_name = "letsencrypt-tls-secret-grafana"
    }

    rule {
      host = local.grafana_api_fqdn

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "grafana"
              port { number = 80 }
            }
          }
        }
      }
    }
  }
}
